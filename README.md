# Flow Continuity Agent

A demoable prototype of an **agentic decision system** for a metered generative-AI platform. When a user tries to run a generation that costs more credits than they have, the system decides — in real time — whether to front credits, warn, offer a purchase, block, or escalate.

Built on **TanStack Start** (React 19 + Vite 7) with the **AI SDK** + **Lovable AI Gateway** (`google/gemini-3.5-flash`).

## Demo Scenarios

| Persona | Key Signals | Expected Path | Outcome |
|---|---|---|---|
| **Maya** (u1) | Pro, 26mo, fraud 5, 0 failed, overage 35 | Gate passes → Tier 2 reasoning | `AUTO_GRANT` — small overage, trusted, margin positive |
| **Devin** (u2) | Standard, 0mo, no consent, overage 100 | Gate: no-consent large overage | `OFFER_PURCHASE` — must buy credits |
| **ghostpix** (u3) | Fraud 78, 3 failed, chargebacks | Gate: fraud / abuse | `BLOCK` — manual top-up only |
| **Alex** (u4) | Pro, 14mo, 1 failed payment, overage 80 | Gate passes → Tier 3 reasoning | `COMPLETE_ONLY_LIMIT_FUTURE` — borderline signal, large overage |
| **Studio Nine** (u5) | Team, fraud 72, high LTV | Gate: fraud score, but team + high LTV | `ESCALATE` + notify admin |
| **Nadia** (u6) | Pro, 40mo, overage 600 | Gate passes → validate clamps | `OFFER_PURCHASE` — exceeds max single grant (150) |
| **Theo** (u7) | Pro, 9mo, overage 60 | Gate passes → Tier 3 reasoning | `AUTO_GRANT` or `WARN_AND_ALLOW` — trusted, margin OK |
| **Priya** (u8) | Standard, 16mo, overage 40, near cap | Gate passes → validate clamps | `OFFER_PURCHASE` — remaining cap too small |

---

## The Problem

Metered AI tools cut you off the moment you run out of credits — often mid-generation, when you're deepest in the work.

A hard stop treats your most loyal customer exactly like a fraudster.

That's the worst moment to be blunt: high intent, high emotion → failed jobs, tickets, churn.

The fix: **decide per user** — let some continue, warn some, sell to some, block some — instead of one rule for all.

## Why It Matters

Hits retention, trust, and margin at the same time, at a high-intent moment.

This is about **judgment**, not a billion-dollar line item. The leverage is in getting the decision right when the user is most engaged.

## What's Mocked vs. Real

| Mocked (illustrative data) | Real (production logic) |
|---|---|
| All user data, LTV, credit numbers | The gates, the agent's reasoning, the decision logic |

**Cut on purpose** to keep scope tight:
- Live exhaustion prediction
- Separate risk subagent
- Full team-admin UI

---

## Agent Architecture

The decision pipeline has two stages: a **deterministic gate layer** (cheap, rule-based, handles the clear-cut cases) and a **reasoning agent** (LLM with tools, handles the grey-zone judgment calls).

```text
                  ┌─────────────────────────┐
   user_id ─────▶ │  decideForUser (RPC)    │  src/lib/decide.functions.ts
                  │  TanStack server fn     │
                  └───────────┬─────────────┘
                              │ loads seed rows for user
                              ▼
                  ┌─────────────────────────┐
                  │  Deterministic Gates    │
                  │  • fraud_score          │
                  │  • failed_payments      │
                  │  • abuse_flags          │
                  │  • consent + overage    │
                  └───────┬────────┬────────┘
              clear-cut   │        │   grey-zone
            BLOCK/ESCALATE│        │  (passes through)
            OFFER_PURCHASE│        ▼
                          │   ┌─────────────────────────────┐
                          │   │  runAgent (Orchestrator)    │  src/lib/agent.server.ts
                          │   │  AI SDK generateText loop   │
                          │   │  model: gemini-3.5-flash    │
                          │   │  stopWhen: stepCountIs(8)   │
                          │   │           hasToolCall(...)  │
                          │   └──────────────┬──────────────┘
                          │                  │ tiered investigation
                          │                  ▼
                          │   ┌─────────────────────────────┐
                          │   │  Tools (Zod-validated)      │
                          │   │   getAccount                │
                          │   │   getLedger                 │
                          │   │   getPayments               │
                          │   │   getLtv                    │
                          │   │   getUsage                  │
                          │   │   getMargin                 │
                          │   │   submitDecision  ← stops   │
                          │   └──────────────┬──────────────┘
                          │                  │ trace[] of tool calls
                          │                  ▼
                          │   ┌─────────────────────────────┐
                          │   │  validate()                 │
                          │   │  • clamp to continuity_cap  │
                          │   │  • clamp to max_single_grant│
                          │   │  • compute next_bill_delta  │
                          │   │  • requires_confirmation?   │
                          │   └──────────────┬──────────────┘
                          │                  │
                          └────────┬─────────┘
                                   ▼
                       ┌───────────────────────┐
                       │  Decision (Zod)       │
                       │  + trace[] for UI     │
                       └───────────────────────┘
```

### Stage 1 — Deterministic Gates (`decide.functions.ts`)

Cheap, auditable rules that run before the LLM is ever called:

| Gate | Condition | Outcome |
|---|---|---|
| Fraud / abuse | `fraud_score ≥ 70`, `failed_payments ≥ 2`, or abuse flag present | `BLOCK` (or `ESCALATE` if high-LTV / team) |
| Consent | `overage_consent=false` AND overage > threshold | `OFFER_PURCHASE` |
| No overage | `balance ≥ credits_required` | `AUTO_GRANT` (0 credits) |

Everything else falls through to the reasoning agent.

### Stage 2 — Reasoning Agent (`agent.server.ts`)

A single-loop AI SDK agent (`generateText` + tools) acting as the **orchestrator**. The system prompt tells it the deterministic safety gates (fraud, abuse, no-consent large overage, hard caps) have already cleared this case — it only sees grey-zone judgment calls and must choose between:

- **`AUTO_GRANT`** — trusted user, manageable overage, margin positive.
- **`WARN_AND_ALLOW`** — same, but the `user_message` leads with a heads-up.
- **`COMPLETE_ONLY_LIMIT_FUTURE`** — front credits for **this** job, require confirm/payment before the next one.
- **`OFFER_PURCHASE`** — no fronting; show a credit-pack purchase.

**Tiered investigation policy** baked into the system prompt — every tool call is framed as having real cost (external APIs / expensive queries), so the agent investigates proportionally to the stakes:

- **Tier 1 (always)** — pull `getLedger` to confirm overage size. Optionally `getAccount` for plan / tenure.
- **Tier 2 (small clean overage + trusted signal)** — decide in ~2 calls. Do **not** pull `getLtv` / `getUsage` / `getMargin` for a tiny grant on a clean account.
- **Tier 3 (large overage OR borderline signal like a recent failed payment)** — pull `getLtv` and `getMargin` before any grant. Add `getUsage` if the usage pattern matters.
- **Hard rule** — a grant must always fit remaining continuity cap and `max_single_grant`. If `getMargin` shows the grant breaks margin, prefer `COMPLETE_ONLY_LIMIT_FUTURE` or `OFFER_PURCHASE`.

**`user_message` style** — warm, concise, transparent about next-bill impact.

**Loop control**: stops on `stepCountIs(8)` **or** `hasToolCall("submitDecision")`. The agent is instructed not to keep investigating once it has enough evidence to answer.

### Tools

All tools have narrow Zod input schemas and compact, serializable outputs. Every call is appended to a `trace[]` rendered in the UI for transparency.

| Tool | Purpose |
|---|---|
| `getAccount` | Plan, tenure, account type, consent |
| `getLedger` | Balance, monthly allotment, continuity used/cap, enriched with overage |
| `getPayments` | On-time count, failed-in-90d, last status |
| `getLtv` | LTV tier + USD — pull for non-trivial grants |
| `getUsage` | Avg monthly generations, limit-hits, pattern |
| `getMargin` | Computes margin for a proposed grant (`billed − platform_cost`) |
| `submitDecision` | Terminal tool — emits the final structured `Decision` and stops the loop |

### Validation & Clamping

After the agent submits, `validate()` enforces hard policy invariants the LLM cannot violate:

- `continuity_credits_granted ≤ min(overage, remaining_cap, max_single_grant)`
- If clamping would underfund the job → downgrade to `OFFER_PURCHASE`
- Compute `next_bill_delta_usd = credits × credit_rate_usd`
- Set `requires_confirmation` if delta > `silent_grant_threshold_usd`

### Decision Shape (Zod-validated)

```ts
{
  decision: "AUTO_GRANT" | "WARN_AND_ALLOW" | "COMPLETE_ONLY_LIMIT_FUTURE"
          | "OFFER_PURCHASE" | "BLOCK" | "ESCALATE",
  continuity_credits_granted: number,
  next_bill_delta_usd: number,
  confidence: "high" | "medium" | "low",
  rationale: string,
  rejected_alternatives: { action: string, why_not: string }[],
  user_message: string,                 // shown directly to the creator
  limit_future: boolean,
  notify_admin: boolean,
  requires_confirmation: boolean,
  path: "gate" | "reasoning",
  trace: { tool, args_json, result_json }[],
}
```

---

## File Map

| File | Role |
|---|---|
| `src/lib/decide.functions.ts` | Server fn entry point + deterministic gates + validate/clamp |
| `src/lib/agent.server.ts` | Orchestrator agent, tools, AI SDK loop |
| `src/lib/ai-gateway.server.ts` | Lovable AI Gateway provider |
| `src/lib/decision-types.ts` | Zod schemas + seed types |
| `src/data/seed.json` | Policy + 8 demo users (accounts, ledger, payments, risk, LTV, usage, jobs) |
| `src/routes/index.tsx` | Single-page demo UI |
| `src/components/credit-agent/*` | ScenarioPicker, CreatorView, ReasoningPanel, DecisionCard, DataTablesTab, PolicyPanel |

---

## Running

```bash
bun install
bun dev
```

Requires `LOVABLE_API_KEY` in the environment (auto-provisioned by Lovable Cloud).
