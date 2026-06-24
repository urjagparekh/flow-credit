
# Credit Continuity Agent — Working Prototype

A demoable single-page prototype. No Supabase, no DB, no auth. JSON seed + one server function for the LLM call. Follows the README §4–§13 exactly — no invented behavior.

## Stack

- **Frontend:** TanStack Start (existing template), Tailwind + shadcn
- **Backend:** one `createServerFn` `decide()` — needed only to keep the LLM key server-side
- **LLM:** Lovable AI Gateway, `google/gemini-3-flash-preview`, temperature 0.2, JSON-only output. `LOVABLE_API_KEY` is auto-provisioned — nothing for you to paste.
- **Data:** `src/data/seed.json` with the exact tables and policy from §4–§5

## Files

```
src/data/seed.json                  §4 policy + §5 tables (verbatim)
src/lib/ai-gateway.server.ts        Lovable AI Gateway provider
src/lib/decision-types.ts           Decision schema (Zod) + types
src/lib/decide.functions.ts         createServerFn: gates → LLM → validate/clamp
src/routes/index.tsx                Single-page demo (replaces placeholder)
src/components/credit-agent/
  ScenarioPicker.tsx                Maya / Devin / ghostpix / Alex / Studio Nine
  CreatorView.tsx                   Plan badge, CreditMeter, PendingJob, Generate
  DecisionCard.tsx                  user_message + decision CTA + confirm + "Not now"
  ReasoningPanel.tsx                Fetch steps, badge, rationale, rejected alts, NextBillPreview
  DataTablesTab.tsx                 Seed tables with selected row highlighted
  PolicyPanel.tsx                   Policy values
```

## decide() pipeline (§7, §9 verbatim)

1. **Gates (pure code):**
   - fraud_score ≥ 70 OR failed_payments_90d ≥ 2 OR abuse_flags → BLOCK; if LTV=high or team → ESCALATE + notify_admin
   - no consent + overage > continuity_threshold → OFFER_PURCHASE
2. **LLM (grey zone only):** §8 system prompt verbatim; sends account/ledger/payment/risk/ltv/usage/job/policy + computed overage, remainingCap, capConstrained
3. **Validate/clamp:** maxGrant = min(overage, remainingCap, max_single_grant); downgrade to OFFER_PURCHASE if can't fully cover; compute next_bill_delta_usd; requires_confirmation when delta > $5; force notify_admin on team accounts

## UI (§10)

One page: ScenarioPicker at top → CreatorView + ReasoningPanel side-by-side → DecisionCard appears after Generate → tabs for Data Tables and Policy below. Warm, calm creator-tool aesthetic (not alarming). Distinct visual treatment per decision type.

## Expected outcomes (§5) — verified after build

| User | Decision |
|---|---|
| Maya | AUTO_GRANT 35, +$3.50, no confirm |
| Devin | OFFER_PURCHASE (gate) |
| ghostpix | BLOCK (gate) |
| Alex | COMPLETE_ONLY_LIMIT_FUTURE 80, +$8, requires confirm |
| Studio Nine | ESCALATE + notify_admin (gate) |

u1/u4 go through the LLM and may vary slightly — that's the point.

## Scope choices (per README)

- Pre-flight check at Generate click — no live burn-rate prediction
- Skip optional RiskAssessor subagent — main agent assesses risk inline (§7 says optional)
- "Fetch steps" in ReasoningPanel display pre-fetched data, not real function-calling

Demoable from the preview URL the moment it builds. Click any of 5 users → Generate → see the decision + reasoning.
