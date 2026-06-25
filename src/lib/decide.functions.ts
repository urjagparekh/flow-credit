import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import seed from "@/data/seed.json";
import {
  DecisionSchema,
  type Decision,
  type SeedData,
} from "./decision-types";

const db = seed as unknown as SeedData;


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

    try {
      const { runAgent } = await import("./agent.server");
      const { decision: raw, trace } = await runAgent(userId, { overage, remainingCap });
      const d = validate(raw, { overage, remainingCap, policy });
      if (isTeam) d.notify_admin = true;
      d.path = "reasoning";
      d.trace = trace;
      return d;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
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
