import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import seed from "@/data/seed.json";
import {
  DecisionSchema,
  type Decision,
  type SeedData,
} from "./decision-types";

const db = seed as unknown as SeedData;

const SYSTEM_PROMPT = `You are the Credit Continuity Agent for a metered generative-AI platform where users spend
credits per generation. A user is about to run a generation that costs more credits than they
have. Decide how to handle it.

You receive JSON with: account, credit ledger, payment history, risk signals, ltv, usage
pattern, the pending job, and the platform policy (caps, thresholds, rates). Clear-cut cases
(fraud, no-consent large overage) are handled before you — you only see cases that need judgment.

Choose exactly ONE action:
- AUTO_GRANT: front continuity credits, complete the job now, reconcile on the next bill. Use for
  trusted users with manageable overage where margin stays positive.
- WARN_AND_ALLOW: same as AUTO_GRANT, but the user message leads with a clear heads-up about the
  overage and next-bill impact. Use when allowing is right but the overage is non-trivial.
- COMPLETE_ONLY_LIMIT_FUTURE: front credits for THIS job only, and require the user to confirm or
  add a payment method before the next one. Use when the relationship is valuable but there is
  real exposure (e.g. a recent payment failure, or a large variable-cost job).
- OFFER_PURCHASE: do not front credits; present a one-click credit-pack purchase to continue. Use
  when trust is not established or exposure is too high to absorb.
- BLOCK: do not continue; manual top-up only.

Weigh these factors and reason explicitly across the trade-offs — do not pattern-match to one
signal:
- LTV tier and tenure (relationship value)
- payment history, especially recent failures (exposure)
- overage size, and whether the job has a variable / unpredictable cost
- first-time vs repeated limit hits (pattern)
- margin: continuity credits cost platform_cost_per_credit_usd and are billed at credit_rate_usd;
  a grant should keep margin positive
- consent and remaining continuity cap

Hard rules you must obey:
- continuity_credits_granted must equal the overage and must not exceed the remaining continuity
  cap or max_single_grant_credits. If it would, do NOT AUTO_GRANT — choose OFFER_PURCHASE or
  COMPLETE_ONLY_LIMIT_FUTURE.
- never invent prices or credit amounts beyond policy.
- next_bill_delta_usd = continuity_credits_granted * credit_rate_usd.

In rejected_alternatives, explain why the next-best action was NOT chosen.

Note: admin notification (team accounts), escalation of high-value risk cases, and the
confirm-above-threshold step are applied by the system around your decision — you focus on the
AUTO_GRANT / WARN_AND_ALLOW / COMPLETE_ONLY_LIMIT_FUTURE / OFFER_PURCHASE judgment.

The user_message is shown directly to the creator: warm, concise, transparent about any overage
and next-bill impact, never alarming.

Respond with ONLY a JSON object — no prose outside it — with these fields:
decision, continuity_credits_granted, next_bill_delta_usd, confidence (high|medium|low),
rationale, rejected_alternatives (array of {action, why_not}), user_message, limit_future,
notify_admin, requires_confirmation, signals_used {ltv_tier, risk_level, overage,
payment_status, tenure_months, consent}.`;

const row = <T extends { user_id: string }>(arr: T[], id: string): T => {
  const r = arr.find((x) => x.user_id === id);
  if (!r) throw new Error(`No row for user ${id}`);
  return r;
};

function mk(
  decision: Decision["decision"],
  credits: number,
  overage: number,
  user_message: string,
  opts: Partial<Decision> = {},
): Decision {
  return DecisionSchema.parse({
    decision,
    continuity_credits_granted: credits,
    next_bill_delta_usd: 0,
    rationale: "Deterministic gate.",
    user_message,
    rejected_alternatives: [],
    signals_used: {
      ltv_tier: "",
      risk_level: "",
      overage,
      payment_status: "",
      tenure_months: 0,
      consent: false,
    },
    path: "gate",
    ...opts,
  });
}

function validate(
  d: Decision,
  ctx: { overage: number; remainingCap: number; policy: SeedData["policy"] },
): Decision {
  const { overage, remainingCap, policy } = ctx;
  const maxGrant = Math.min(overage, remainingCap, policy.max_single_grant_credits);
  if (
    ["AUTO_GRANT", "WARN_AND_ALLOW", "COMPLETE_ONLY_LIMIT_FUTURE"].includes(d.decision)
  ) {
    d.continuity_credits_granted = Math.min(
      d.continuity_credits_granted ?? overage,
      maxGrant,
    );
    if (d.continuity_credits_granted < overage) {
      d.decision = "OFFER_PURCHASE";
      d.continuity_credits_granted = 0;
    } else {
      d.next_bill_delta_usd = +(
        d.continuity_credits_granted * policy.credit_rate_usd
      ).toFixed(2);
      d.requires_confirmation =
        d.next_bill_delta_usd > policy.silent_grant_threshold_usd;
    }
  } else {
    d.continuity_credits_granted = 0;
    d.next_bill_delta_usd = 0;
  }
  return d;
}


export const decideForUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ userId: z.string() }).parse(input))
  .handler(async ({ data }): Promise<Decision> => {
    const userId = data.userId;
    const a = row(db.accounts, userId);
    const l = row(db.credit_ledger, userId);
    const p = row(db.payment_history, userId);
    const r = row(db.risk_signals, userId);
    const ltv = row(db.ltv, userId);
    const usage = row(db.usage_history, userId);
    const job = row(db.pending_jobs, userId);
    const policy = db.policy;

    const overage = job.credits_required - l.balance;
    if (overage <= 0) {
      return mk("AUTO_GRANT", 0, 0, "You have enough credits — continuing.");
    }

    const isTeam = a.account_type === "team";

    // Deterministic gates
    const blockCondition =
      r.fraud_score >= policy.fraud_score_block_threshold ||
      p.failed_payments_last_90d >= policy.failed_payments_block_threshold ||
      r.abuse_flags.length > 0;

    if (blockCondition) {
      if (ltv.tier === "high" || isTeam) {
        return mk(
          "ESCALATE",
          0,
          overage,
          "Paused to confirm a few details — your account manager has been notified and will follow up shortly.",
          { notify_admin: true },
        );
      }
      return mk(
        "BLOCK",
        0,
        overage,
        "Account flagged — manual top-up required to continue.",
        { notify_admin: isTeam },
      );
    }

    if (!a.overage_consent && overage > policy.continuity_threshold_credits) {
      return mk(
        "OFFER_PURCHASE",
        0,
        overage,
        "Add credits to keep generating.",
        { notify_admin: isTeam },
      );
    }

    const remainingCap = l.continuity_cap - l.continuity_used_this_cycle;
    const capConstrained =
      overage > remainingCap || overage > policy.max_single_grant_credits;

    const ctx = {
      account: a,
      ledger: l,
      payment: p,
      risk: r,
      ltv,
      usage,
      job,
      policy,
      overage,
      remainingCap,
      capConstrained,
    };

    try {
      const raw = await callLLM(ctx);
      const d = validate(raw, { overage, remainingCap, policy });
      if (isTeam) d.notify_admin = true;
      d.path = "reasoning";
      return d;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Surface a safe fallback rather than 500
      return mk(
        "OFFER_PURCHASE",
        0,
        overage,
        "Add credits to keep generating.",
        {
          rationale: `Reasoning agent unavailable: ${message}`,
          notify_admin: isTeam,
        },
      );
    }
  });
