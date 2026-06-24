import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import seed from "@/data/seed.json";
import type { SeedData } from "@/lib/decision-types";
import { cn } from "@/lib/utils";
import { Sparkles, Loader2 } from "lucide-react";

const db = seed as unknown as SeedData;

type Props = {
  userId: string;
  onGenerate: () => void;
  loading: boolean;
};

export function CreatorView({ userId, onGenerate, loading }: Props) {
  const a = db.accounts.find((x) => x.user_id === userId)!;
  const l = db.credit_ledger.find((x) => x.user_id === userId)!;
  const job = db.pending_jobs.find((x) => x.user_id === userId)!;
  const overage = job.credits_required - l.balance;
  const low = l.balance < job.credits_required;
  const pct = Math.min(100, (l.balance / l.monthly_allotment) * 100);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Creator
          </div>
          <div className="mt-1 text-xl font-semibold">{a.name}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{a.plan}</Badge>
          <Badge
            variant={a.subscription_status === "active" ? "outline" : "destructive"}
            className="capitalize"
          >
            {a.subscription_status.replace("_", " ")}
          </Badge>
          {a.account_type === "team" && <Badge>Team</Badge>}
        </div>
      </div>

      {/* Credit meter */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between text-sm">
          <div className="text-muted-foreground">Credit balance</div>
          <div className="font-mono">
            <span
              className={cn(
                "text-xl font-semibold",
                low ? "text-amber-600 dark:text-amber-400" : "text-foreground",
              )}
            >
              {l.balance}
            </span>
            <span className="text-muted-foreground">
              {" "}
              / {l.monthly_allotment.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              low ? "bg-amber-500" : "bg-foreground",
            )}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
      </div>

      {/* Pending job */}
      <div className="mt-6 rounded-xl border border-border bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Pending generation
            </div>
            <div className="mt-1 font-medium">{job.job_type}</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono">
              needs <span className="font-semibold">{job.credits_required}</span>
            </div>
            <div className="text-muted-foreground">
              you have{" "}
              <span className="font-mono">{l.balance}</span>
            </div>
          </div>
        </div>
        {overage > 0 && (
          <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Short by <span className="font-semibold font-mono">{overage}</span>{" "}
            credits.
          </div>
        )}
      </div>

      <Button
        onClick={onGenerate}
        disabled={loading}
        className="mt-6 w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Deciding…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 size-4" />
            Generate
          </>
        )}
      </Button>
    </div>
  );
}
