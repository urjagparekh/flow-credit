import { Badge } from "@/components/ui/badge";
import type { Decision } from "@/lib/decision-types";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

function summarize(toolName: string, resultJson: string): string {
  try {
    const r = JSON.parse(resultJson);
    if (r == null) return "—";
    switch (toolName) {
      case "getAccount":
        return `${r.plan} · ${r.tenure_months}mo · ${r.account_type}`;
      case "getLedger":
        return `bal ${r.balance}/${r.monthly_allotment} · overage ${r.overage} · cap left ${r.remaining_continuity_cap}`;
      case "getPayments":
        return `${r.failed_payments_last_90d} failed 90d · ${r.last_status}`;
      case "getLtv":
        return `${r.tier} · $${(r.ltv_usd ?? 0).toLocaleString()}`;
      case "getUsage":
        return `${r.pattern} · ${r.times_hit_limit_90d}× limit/90d`;
      case "getMargin":
        return `bill $${r.billed_usd} · cost $${r.cost_usd} · margin $${r.margin_usd}`;
      case "assessRisk":
        return `${r.risk_level} — ${r.reasoning}`;
      case "submitDecision":
        return "final answer";
      default:
        return JSON.stringify(r).slice(0, 80);
    }
  } catch {
    return resultJson.slice(0, 60);
  }
}

export function ReasoningPanel({ decision }: { userId: string; decision: Decision }) {
  const trace = decision.trace ?? [];
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
