import { generateText, tool, stepCountIs, hasToolCall } from "ai";
import { z } from "zod";
import seed from "@/data/seed.json";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { DecisionSchema, type Decision, type SeedData } from "./decision-types";

const db = seed as unknown as SeedData;
const MODEL = "google/gemini-3-flash-preview";

const row = <T extends { user_id: string }>(arr: T[], id: string): T => {
  const r = arr.find((x) => x.user_id === id);
  if (!r) throw new Error(`No row for user ${id}`);
  return r;
};

export type TraceStep = {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
};

const MAIN_PROMPT = `You are the Credit Continuity Agent for a metered generative-AI platform. A user is about to run a generation that costs more credits than they have. Deterministic safety gates (fraud, abuse, no-consent large overage, hard caps) have ALREADY run and cleared this case — you only see grey-zone judgment calls.

You investigate by calling tools. Each tool call has real cost (external APIs / expensive queries), so investigate PROPORTIONALLY to the stakes. Do NOT fetch what a trivial case doesn't need.

Tiered investigation policy:
- TIER 1 (always): getLedger to confirm overage size. Optionally getAccount for plan/tenure.
- TIER 2 (small clean overage + trusted signal): you may decide now in ~2 calls. Don't pull LTV/usage/margin for a tiny grant on a clean account.
- TIER 3 (large overage OR borderline signal like a recent failed payment): call assessRisk subagent, then pull getLtv and getMargin before any grant. Add getUsage if pattern matters.
- HARD: a grant must always fit remaining continuity cap and max_single_grant. If getMargin shows the grant breaks margin, prefer COMPLETE_ONLY_LIMIT_FUTURE or OFFER_PURCHASE.

Decisions you may choose:
- AUTO_GRANT — trusted, manageable overage, margin positive.
- WARN_AND_ALLOW — same, but the user_message leads with a heads-up.
- COMPLETE_ONLY_LIMIT_FUTURE — front credits for THIS job, require confirm/payment before next.
- OFFER_PURCHASE — no fronting; show a credit-pack purchase.

When you have enough evidence, call submitDecision with the final JSON. Do NOT keep investigating after you can answer. The user_message must be warm, concise, transparent about next-bill impact.`;

const RISK_PROMPT = `You are the RiskAssessor subagent. Given a user's payment_history and risk_signals JSON, return a risk_level (low|medium|high) and a one-sentence reasoning. Be strict about recent failed payments and refund counts; ignore stale issues.`;

export async function runAgent(
  userId: string,
  ctx: { overage: number; remainingCap: number },
): Promise<{ decision: Decision; trace: TraceStep[] }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key);
  const model = gateway(MODEL);
  const trace: TraceStep[] = [];

  const record = (name: string, args: Record<string, unknown>, result: unknown) => {
    trace.push({ tool: name, args, result });
  };

  const tools = {
    getAccount: tool({
      description: "Account plan, tenure, account type, consent.",
      inputSchema: z.object({ user_id: z.string() }),
      execute: async ({ user_id }) => {
        const r = row(db.accounts, user_id);
        record("getAccount", { user_id }, r);
        return r;
      },
    }),
    getLedger: tool({
      description: "Credit balance, monthly allotment, continuity used/cap.",
      inputSchema: z.object({ user_id: z.string() }),
      execute: async ({ user_id }) => {
        const r = row(db.credit_ledger, user_id);
        const enriched = { ...r, overage: ctx.overage, remaining_continuity_cap: ctx.remainingCap };
        record("getLedger", { user_id }, enriched);
        return enriched;
      },
    }),
    getPayments: tool({
      description: "Detailed payment history — on-time count, failed in 90d, last status.",
      inputSchema: z.object({ user_id: z.string() }),
      execute: async ({ user_id }) => {
        const r = row(db.payment_history, user_id);
        record("getPayments", { user_id }, r);
        return r;
      },
    }),
    getLtv: tool({
      description: "Lifetime value tier and USD. Pull for non-trivial grants.",
      inputSchema: z.object({ user_id: z.string() }),
      execute: async ({ user_id }) => {
        const r = row(db.ltv, user_id);
        record("getLtv", { user_id }, r);
        return r;
      },
    }),
    getUsage: tool({
      description: "Avg monthly generations, times hit limit in 90d, pattern.",
      inputSchema: z.object({ user_id: z.string() }),
      execute: async ({ user_id }) => {
        const r = row(db.usage_history, user_id);
        record("getUsage", { user_id }, r);
        return r;
      },
    }),
    getMargin: tool({
      description:
        "Compute margin for a proposed grant: credits * (credit_rate_usd - platform_cost_per_credit_usd).",
      inputSchema: z.object({ credits: z.number() }),
      execute: async ({ credits }) => {
        const p = db.policy;
        const billed = credits * p.credit_rate_usd;
        const cost = credits * p.platform_cost_per_credit_usd;
        const out = {
          credits,
          billed_usd: +billed.toFixed(2),
          cost_usd: +cost.toFixed(2),
          margin_usd: +(billed - cost).toFixed(2),
          margin_positive: billed - cost > 0,
        };
        record("getMargin", { credits }, out);
        return out;
      },
    }),
    assessRisk: tool({
      description:
        "Subagent: independent risk assessment over payment + risk signals. Returns {risk_level, reasoning}.",
      inputSchema: z.object({ user_id: z.string() }),
      execute: async ({ user_id }) => {
        const payment = row(db.payment_history, user_id);
        const risk = row(db.risk_signals, user_id);
        const sub = await generateText({
          model,
          temperature: 0.1,
          system: RISK_PROMPT,
          prompt: `Assess risk. Return ONLY JSON {"risk_level":"low|medium|high","reasoning":"..."}.\n${JSON.stringify({ payment, risk })}`,
        });
        const cleaned = sub.text.replace(/```json|```/g, "").trim();
        const s = cleaned.indexOf("{");
        const e = cleaned.lastIndexOf("}");
        let parsed: { risk_level: string; reasoning: string };
        try {
          parsed = JSON.parse(s >= 0 ? cleaned.slice(s, e + 1) : cleaned);
        } catch {
          parsed = { risk_level: "medium", reasoning: "Subagent parse fallback." };
        }
        record("assessRisk", { user_id }, parsed);
        return parsed;
      },
    }),
    submitDecision: tool({
      description:
        "Submit the final decision. Call this exactly once when you have enough evidence. The loop stops after this.",
      inputSchema: z.object({
        decision: z.enum([
          "AUTO_GRANT",
          "WARN_AND_ALLOW",
          "COMPLETE_ONLY_LIMIT_FUTURE",
          "OFFER_PURCHASE",
        ]),
        continuity_credits_granted: z.number(),
        confidence: z.enum(["high", "medium", "low"]),
        rationale: z.string(),
        rejected_alternatives: z
          .array(z.object({ action: z.string(), why_not: z.string() }))
          .default([]),
        user_message: z.string(),
        limit_future: z.boolean().default(false),
      }),
      execute: async (input) => {
        record("submitDecision", input as Record<string, unknown>, "ok");
        return { ok: true };
      },
    }),
  };

  const result = await generateText({
    model,
    temperature: 0.2,
    system: MAIN_PROMPT,
    prompt: `Case: user_id=${userId}. Pre-computed overage=${ctx.overage} credits. Remaining continuity cap=${ctx.remainingCap}. Investigate proportionally, then call submitDecision.`,
    tools,
    stopWhen: [stepCountIs(8), hasToolCall("submitDecision")],
  });

  const submit = trace.find((t) => t.tool === "submitDecision");
  if (!submit) {
    throw new Error(
      `Agent stopped without submitDecision. Last text: ${result.text?.slice(0, 200) ?? "(none)"}`,
    );
  }
  const raw = submit.args as Record<string, unknown>;
  const decision = DecisionSchema.parse({
    ...raw,
    next_bill_delta_usd: 0,
    signals_used: {
      ltv_tier: "",
      risk_level: "",
      overage: ctx.overage,
      payment_status: "",
      tenure_months: 0,
      consent: false,
    },
    path: "reasoning",
  });
  return { decision, trace };
}
