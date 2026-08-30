# Billing and usage

Entitlement and metering are separate:


| Concern               | Source of truth                                 |
| --------------------- | ----------------------------------------------- |
| Plan (`free` | `pro`) | `profiles.plan`, updated by Stripe webhooks     |
| Generate slots        | Postgres `usage_events` (reserve / soft refund) |


Checkout success URLs never write plan. Redis is not involved in quotas.

## Stripe (entitlement)

- **Checkout** — subscription mode for Pro monthly (`createCheckoutSessionForPro`)
- **Customer Portal** — cancel / payment recovery; incomplete or unpaid flows may redirect here instead of a new Checkout
- **Webhooks** — verified at `/api/stripe/webhook`; handler re-fetches live subscription state from Stripe, then patches the profile

Events that drive sync include `checkout.session.completed`, `customer.subscription.created|updated|deleted`, and invoice subscription events.

### Status


| Stripe `subscription.status`                           | App plan |
| ------------------------------------------------------ | -------- |
| `active`, `trialing`, `past_due`                       | `pro`    |
| `canceled`, `unpaid`, `incomplete*`, `paused`, missing | `free`   |


`past_due` keeps Pro during dunning so metering still uses Pro limits until Stripe cancels or unpaid.

Price id and secrets: `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (see `.env.example`).

## Usage metering

One `usage_events` row per Generate reservation, keyed by `run_id`:

- **Reserve** — before ingest/enqueue; advisory locks + counts for user daily, global hourly/daily, optional IP daily (per model tier)
- **Refund** — set `refunded_at`; active counts ignore refunded rows
- **Period** — UTC day / hour keys (`period_day`, `period_hour`)

Limits live in `analysisConfig` (not env):


| Scope                 | Free        | Pro  | Notes                             |
| --------------------- | ----------- | ---- | --------------------------------- |
| User daily `basic`    | 10          | 20   | Per `profiles.plan`               |
| User daily `advanced` | 5           | 15   |                                   |
| Global hourly / daily | shared caps | same | Cost guardrails for the whole app |
| IP daily              | optional    | same | Guest abuse brake (`ip_hash`)     |


Model tiers also cap video length (basic ~20 min, advanced ~2 h) and transcript budget. Generate UI uses `evaluateGenerateGate` so users see exhausted / too-long before reserve when possible.

### Reserve → refund around Generate

```text
reserve(run_id, tier)
  → duration / ingest / enqueue
  → on failure: refund(run_id)
  → on re-Generate replacing prior run: refund(priorRunId)
```

Successful completes keep the row (counts toward the day). Failed starts that never enqueue should not consume a slot.

## Code entry points


| Concern                     | File                                          |
| --------------------------- | --------------------------------------------- |
| Plan limits + model caps    | `src/domain/analysis/config.ts`               |
| Reserve / refund / snapshot | `src/domain/usage/quota.ts`                   |
| Event store (Postgres)      | `src/domain/usage/event-store.ts`             |
| Pre-Generate gate           | `src/domain/usage/generate-gate.ts`           |
| Read `profiles.plan`        | `src/domain/usage/plan.ts`                    |
| Webhook processing          | `src/domain/billing/webhook.ts`               |
| Status → plan               | `src/domain/billing/plan-from-status.ts`      |
| Checkout / portal           | `src/domain/billing/checkout.ts`, `portal.ts` |
| HTTP webhook                | `src/app/api/stripe/webhook/`                 |


