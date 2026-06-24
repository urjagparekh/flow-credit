import seed from "@/data/seed.json";
import type { SeedData } from "@/lib/decision-types";
import { cn } from "@/lib/utils";

const db = seed as unknown as SeedData;

type Props = {
  selectedUserId: string | null;
  onSelect: (id: string) => void;
};

export function ScenarioPicker({ selectedUserId, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {db.accounts.map((a) => {
        const active = a.user_id === selectedUserId;
        return (
          <button
            key={a.user_id}
            onClick={() => onSelect(a.user_id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-all",
              active
                ? "border-foreground bg-foreground text-background shadow-sm"
                : "border-border bg-card text-foreground hover:border-foreground/40",
            )}
          >
            {a.name}
            <span
              className={cn(
                "ml-2 text-xs",
                active ? "text-background/70" : "text-muted-foreground",
              )}
            >
              {a.plan}
              {a.account_type === "team" ? " · team" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
