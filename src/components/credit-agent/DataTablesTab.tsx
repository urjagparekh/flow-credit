import seed from "@/data/seed.json";
import type { SeedData } from "@/lib/decision-types";
import { cn } from "@/lib/utils";

const db = seed as unknown as SeedData;

type Section = { title: string; rows: Record<string, unknown>[] };

export function DataTablesTab({ selectedUserId }: { selectedUserId: string | null }) {
  const sections: Section[] = [
    { title: "accounts", rows: db.accounts },
    { title: "credit_ledger", rows: db.credit_ledger },
    { title: "payment_history", rows: db.payment_history },
    { title: "risk_signals", rows: db.risk_signals },
    { title: "ltv", rows: db.ltv },
    { title: "usage_history", rows: db.usage_history },
    { title: "pending_jobs", rows: db.pending_jobs },
  ];

  return (
    <div className="space-y-6">
      {sections.map((s) => {
        const cols = Object.keys(s.rows[0] ?? {});
        return (
          <div
            key={s.title}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="border-b border-border bg-muted/40 px-4 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {s.title}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background">
                    {cols.map((c) => (
                      <th
                        key={c}
                        className="px-3 py-2 text-left font-mono text-xs font-medium text-muted-foreground"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((row, i) => {
                    const isSel =
                      (row as { user_id?: string }).user_id === selectedUserId;
                    return (
                      <tr
                        key={i}
                        className={cn(
                          "border-b border-border last:border-b-0",
                          isSel && "bg-amber-50 dark:bg-amber-950/30",
                        )}
                      >
                        {cols.map((c) => (
                          <td
                            key={c}
                            className="whitespace-nowrap px-3 py-2 font-mono text-xs"
                          >
                            {formatCell((row as Record<string, unknown>)[c])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.length === 0 ? "[]" : `[${v.join(", ")}]`;
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}
