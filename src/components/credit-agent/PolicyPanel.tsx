import seed from "@/data/seed.json";
import type { SeedData } from "@/lib/decision-types";

const db = seed as unknown as SeedData;

export function PolicyPanel() {
  const p = db.policy;
  const items: { label: string; value: string }[] = [
    {
      label: "continuity_threshold_credits",
      value: String(p.continuity_threshold_credits),
    },
    { label: "max_single_grant_credits", value: String(p.max_single_grant_credits) },
    { label: "credit_rate_usd", value: `$${p.credit_rate_usd.toFixed(2)}/credit` },
    {
      label: "platform_cost_per_credit_usd",
      value: `$${p.platform_cost_per_credit_usd.toFixed(2)}/credit`,
    },
    {
      label: "silent_grant_threshold_usd",
      value: `$${p.silent_grant_threshold_usd.toFixed(2)}`,
    },
    {
      label: "fraud_score_block_threshold",
      value: String(p.fraud_score_block_threshold),
    },
    {
      label: "failed_payments_block_threshold",
      value: String(p.failed_payments_block_threshold),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-xl border border-border bg-card px-4 py-3"
        >
          <div className="font-mono text-xs text-muted-foreground">{it.label}</div>
          <div className="mt-1 font-mono text-sm font-semibold">{it.value}</div>
        </div>
      ))}
      <div className="rounded-xl border border-border bg-card px-4 py-3 sm:col-span-2">
        <div className="font-mono text-xs text-muted-foreground">credit_packs</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {p.credit_packs.map((pack) => (
            <div
              key={pack.credits}
              className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm"
            >
              {pack.credits} credits — ${pack.price_usd}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
