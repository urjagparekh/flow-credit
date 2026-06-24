import { z } from "zod";

export const DECISIONS = [
  "AUTO_GRANT",
  "WARN_AND_ALLOW",
  "COMPLETE_ONLY_LIMIT_FUTURE",
  "OFFER_PURCHASE",
  "BLOCK",
  "ESCALATE",
] as const;

export type DecisionAction = (typeof DECISIONS)[number];

export const DecisionSchema = z.object({
  decision: z.enum(DECISIONS),
  continuity_credits_granted: z.number().default(0),
  next_bill_delta_usd: z.number().default(0),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  rationale: z.string().default(""),
  rejected_alternatives: z
    .array(z.object({ action: z.string(), why_not: z.string() }))
    .default([]),
  user_message: z.string().default(""),
  limit_future: z.boolean().default(false),
  notify_admin: z.boolean().default(false),
  requires_confirmation: z.boolean().default(false),
  signals_used: z
    .object({
      ltv_tier: z.string().default(""),
      risk_level: z.string().default(""),
      overage: z.number().default(0),
      payment_status: z.string().default(""),
      tenure_months: z.number().default(0),
      consent: z.boolean().default(false),
    })
    .default({
      ltv_tier: "",
      risk_level: "",
      overage: 0,
      payment_status: "",
      tenure_months: 0,
      consent: false,
    }),
  // gate-only / system meta
  path: z.enum(["gate", "reasoning"]).optional(),
  trace: z
    .array(
      z.object({
        tool: z.string(),
        args_json: z.string().default("{}"),
        result_json: z.string().default("null"),
      }),
    )
    .default([]),
});

export type Decision = z.infer<typeof DecisionSchema>;

export type SeedAccount = {
  user_id: string;
  name: string;
  plan: string;
  subscription_status: string;
  tenure_months: number;
  overage_consent: boolean;
  account_type: "individual" | "team";
  admin_contact?: string;
};

export type SeedLedger = {
  user_id: string;
  balance: number;
  monthly_allotment: number;
  continuity_used_this_cycle: number;
  continuity_cap: number;
};

export type SeedPayment = {
  user_id: string;
  on_time_payments: number;
  failed_payments_last_90d: number;
  last_status: string;
};

export type SeedRisk = {
  user_id: string;
  refund_count: number;
  abuse_flags: string[];
  fraud_score: number;
};

export type SeedLtv = {
  user_id: string;
  ltv_usd: number;
  tier: "high" | "new" | "negative" | "low" | "medium";
};

export type SeedUsage = {
  user_id: string;
  avg_monthly_generations: number;
  times_hit_limit_90d: number;
  pattern: string;
};

export type SeedJob = {
  user_id: string;
  job_type: string;
  credits_required: number;
};

export type Policy = {
  continuity_threshold_credits: number;
  max_single_grant_credits: number;
  credit_rate_usd: number;
  platform_cost_per_credit_usd: number;
  silent_grant_threshold_usd: number;
  fraud_score_block_threshold: number;
  failed_payments_block_threshold: number;
  credit_packs: { credits: number; price_usd: number }[];
};

export type SeedData = {
  policy: Policy;
  accounts: SeedAccount[];
  credit_ledger: SeedLedger[];
  payment_history: SeedPayment[];
  risk_signals: SeedRisk[];
  ltv: SeedLtv[];
  usage_history: SeedUsage[];
  pending_jobs: SeedJob[];
};
