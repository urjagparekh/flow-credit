import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import seed from "@/data/seed.json";
import type { Decision, SeedData } from "@/lib/decision-types";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { CheckCircle2, AlertTriangle, ShieldAlert, ShoppingCart, Ban, UserCog } from "lucide-react";

const db = seed as unknown as SeedData;

const META: Record<
  Decision["decision"],
  { label: string; tone: string; icon: typeof CheckCircle2; cta: string }
> = {
  AUTO_GRANT: {
    label: "Auto-grant",
    tone: "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-900",
    icon: CheckCircle2,
    cta: "Continue creating",
  },
  WARN_AND_ALLOW: {
    label: "Warn & allow",
    tone: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900",
    icon: AlertTriangle,
    cta: "Continue creating",
  },
  COMPLETE_ONLY_LIMIT_FUTURE: {
    label: "Complete only · limit future",
    tone: "bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-100 dark:border-sky-900",
    icon: ShieldAlert,
    cta: "Continue (add payment method for next time)",
  },
  OFFER_PURCHASE: {
    label: "Offer purchase",
    tone: "bg-violet-50 text-violet-900 border-violet-200 dark:bg-violet-950/40 dark:text-violet-100 dark:border-violet-900",
    icon: ShoppingCart,
    cta: "Buy 100 credits — $10",
  },
  BLOCK: {
    label: "Block",
    tone: "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:border-rose-900",
    icon: Ban,
    cta: "Top up to continue",
  },
  ESCALATE: {
    label: "Escalate to human review",
    tone: "bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-100 dark:border-indigo-900",
    icon: UserCog,
    cta: "Under review — we'll follow up",
  },
};

export function DecisionCard({
  userId,
  decision,
}: {
  userId: string;
  decision: Decision;
}) {
  const meta = META[decision.decision];
  const Icon = meta.icon;
  const [confirmed, setConfirmed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const a = db.accounts.find((x) => x.user_id === userId)!;
  const needsConfirm =
    decision.requires_confirmation &&
    decision.continuity_credits_granted > 0 &&
    !confirmed;

  const isInfoOnly = decision.decision === "ESCALATE" || decision.decision === "BLOCK";

  return (
    <div className={cn("rounded-2xl border p-6 shadow-sm", meta.tone)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon className="size-5 shrink-0" />
          <div>
            <div className="text-xs uppercase tracking-wider opacity-70">
              Decision
            </div>
            <div className="text-lg font-semibold">{meta.label}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {decision.notify_admin && (
            <Badge variant="outline" className="border-current">
              Admin notified
            </Badge>
          )}
          {decision.limit_future && (
            <Badge variant="outline" className="border-current">
              Limit future
            </Badge>
          )}
        </div>
      </div>

      <p className="mt-4 text-base leading-relaxed">{decision.user_message}</p>

      {decision.continuity_credits_granted > 0 && (
        <div className="mt-4 rounded-lg bg-background/60 px-3 py-2 text-sm">
          <span className="opacity-70">Grants </span>
          <span className="font-mono font-semibold">
            {decision.continuity_credits_granted}
          </span>
          <span className="opacity-70"> continuity credits · adds </span>
          <span className="font-mono font-semibold">
            ${decision.next_bill_delta_usd.toFixed(2)}
          </span>
          <span className="opacity-70"> to next bill</span>
        </div>
      )}

      {decision.notify_admin && a.admin_contact && (
        <div className="mt-2 text-xs opacity-70">
          Notified: {a.admin_contact}
        </div>
      )}

      {!dismissed && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {needsConfirm ? (
            <Button
              onClick={() => setConfirmed(true)}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              This adds ${decision.next_bill_delta_usd.toFixed(2)} to your next bill —
              continue
            </Button>
          ) : (
            <Button
              disabled={isInfoOnly}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {confirmed ? "Continuing…" : meta.cta}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="hover:bg-background/40"
          >
            {decision.decision === "AUTO_GRANT"
              ? "Dismiss"
              : needsConfirm
                ? "Cancel"
                : "Not now"}
          </Button>
        </div>
      )}

      {dismissed && (
        <div className="mt-5 text-sm opacity-70">Dismissed without granting.</div>
      )}
    </div>
  );
}
