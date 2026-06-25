import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScenarioPicker } from "@/components/credit-agent/ScenarioPicker";
import { CreatorView } from "@/components/credit-agent/CreatorView";
import { DecisionCard } from "@/components/credit-agent/DecisionCard";
import { ReasoningPanel } from "@/components/credit-agent/ReasoningPanel";
import { DataTablesTab } from "@/components/credit-agent/DataTablesTab";
import { PolicyPanel } from "@/components/credit-agent/PolicyPanel";
import { decideForUser } from "@/lib/decide.functions";
import type { Decision } from "@/lib/decision-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flow Continuity Agent" },
      {
        name: "description",
        content:
          "An AI agent for Runway commerce platform, that reasons through customer data and margins to identify grey zone users and provide per-user judgment instead of a hard credit stop for a better customer experience.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const decide = useServerFn(decideForUser);
  const [selectedUserId, setSelectedUserId] = useState<string | null>("u4");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedUserId(id);
    setDecision(null);
    setError(null);
  };

  const handleGenerate = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    setError(null);
    setDecision(null);
    try {
      const d = await decide({ data: { userId: selectedUserId } });
      setDecision(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        {/* Header */}
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Prototype · illustrative data
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Credit Continuity Agent
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Deterministic guardrails for fraud and revenue integrity. An AI agent for
            the grey zone. Per-user judgment instead of a hard credit stop —
            explained.
          </p>
        </header>

        {/* Scenario picker */}
        <section className="mb-6">
          <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
            Pick a scenario
          </div>
          <ScenarioPicker
            selectedUserId={selectedUserId}
            onSelect={handleSelect}
          />
        </section>

        {/* Main grid */}
        {selectedUserId && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <CreatorView
                key={selectedUserId}
                userId={selectedUserId}
                onGenerate={handleGenerate}
                loading={loading}
              />
              {decision && (
                <DecisionCard userId={selectedUserId} decision={decision} />
              )}
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                  <div className="font-semibold">Something went wrong</div>
                  <div className="mt-1 font-mono text-xs">{error}</div>
                </div>
              )}
            </div>
            <div>
              {decision ? (
                <ReasoningPanel userId={selectedUserId} decision={decision} />
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                  The agent's reasoning will appear here after you click Generate.
                </div>
              )}
            </div>
          </section>
        )}

        {/* Inspector tabs */}
        <section className="mt-10">
          <Tabs defaultValue="data">
            <TabsList>
              <TabsTrigger value="data">Data tables</TabsTrigger>
              <TabsTrigger value="policy">Policy</TabsTrigger>
            </TabsList>
            <TabsContent value="data" className="mt-4">
              <DataTablesTab selectedUserId={selectedUserId} />
            </TabsContent>
            <TabsContent value="policy" className="mt-4">
              <PolicyPanel />
            </TabsContent>
          </Tabs>
        </section>

        <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          Prototype · all user data is illustrative · rules for integrity, AI for the
          grey zone.
        </footer>
      </div>
    </div>
  );
}
