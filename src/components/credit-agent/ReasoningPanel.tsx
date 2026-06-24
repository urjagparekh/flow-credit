import { Badge } from "@/components/ui/badge";
import seed from "@/data/seed.json";
import type { Decision, SeedData } from "@/lib/decision-types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const db = seed as unknown as SeedData;

function riskLevel(score: number, failed: number, abuse: string[]): string {
  if (score >= 70 || failed >= 2 || abuse.length > 0) return "high";
  if (score >= 30 || failed >= 1) return "medium";
  return "low";
}

export function ReasoningPanel({
  userId,
  decision,
}: {
  userId: string;
  decision: Decision;
}) {
  const a = db.accounts.find((x) => x.user_id === userId)!;
  const l = db.credit_ledger.find((x) => x.user_id === userId)!;
  const p = db.payment_history.find((x) => x.user_id === userId)!;
  const r = db.risk_signals.find((x) => x.user_id === userId)!;
  const ltv = db.ltv.find((x) => x.user_id === userId)!;

  const steps = [
    { label: "getAccount", value: `${a.plan} · ${a.tenure_months}mo` },
    { label: "getLedger", value: `${l.balance} / ${l.monthly_allotment}` },
    { label: "getPayments", value: `${p.failed_payments_last_90d} failed 90d` },
    {
      label: "getRisk",
      value: `${riskLevel(r.fraud_score, p.failed_payments_last_90d, r.abuse_flags)} · score ${r.fraud_score}`,
    },
    { label: "getLtv", value: `${ltv.tier} · $${ltv.ltv_usd.toLocaleString()}` },
    { label: "getUsage", value: "fetched" },
  ];

  const billed = decision.continuity_credits_granted * 0.1;
  const cost = decision.continuity_credits_granted * 0.04;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Agent reasoning
          </div>
          <div className="mt-1 text-xl font-semibold">How it decided</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {decision.path ?? "reasoning"}
          </Badge>
          {decision.confidence && (
            <Badge variant="secondary" className="capitalize">
              {decision.confidence} confidence
            </Badge>
          )}
        </div>
      </div>

      {/* Fetch steps */}
      <div className="mt-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Data fetched
        </div>
        <ul className="mt-2 space-y-1.5">
          {steps.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between rounded-md bg-background px-3 py-1.5 text-sm"
            >
              <span className="flex items-center gap-2 font-mono">
                <Check className="size-3.5 text-emerald-600" />
                {s.label}
              </span>
              <span className="text-muted-foreground">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Rationale */}
      {decision.rationale && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Rationale
          </div>
          <p className="mt-2 text-sm leading-relaxed">{decision.rationale}</p>
        </div>
      )}

      {/* Rejected alternatives */}
      {decision.rejected_alternatives?.length > 0 && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Rejected alternatives
          </div>
          <ul className="mt-2 space-y-2">
            {decision.rejected_alternatives.map((alt, i) => (
              <li
                key={i}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <div className="font-mono text-xs text-muted-foreground">
                  {alt.action}
                </div>
                <div className="mt-0.5">{alt.why_not}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next bill preview */}
      {decision.continuity_credits_granted > 0 && (
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Next bill preview
          </div>
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-sm">
            <div>
              <div className="text-muted-foreground">Before</div>
              <div className="font-mono font-semibold">$0.00</div>
            </div>
            <div className="text-muted-foreground">→</div>
            <div>
              <div className="text-muted-foreground">After</div>
              <div className="font-mono font-semibold">
                ${decision.next_bill_delta_usd.toFixed(2)}
              </div>
            </div>
            <div
              className={cn(
                "ml-auto text-right text-xs",
                billed - cost >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600",
              )}
            >
              <div>margin</div>
              <div className="font-mono">${(billed - cost).toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
