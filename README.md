# Gross Printing — Print Shop ERP

A full-stack, real-time print-shop management system: orders, production Kanban, inventory with auto-reservation, quotes & invoices, Stripe payments, dynamic product specs, and customer self-service.

Built with **Next.js 15 (App Router) + React 19 + TypeScript + Supabase (Postgres / Auth / Realtime / Storage) + Tailwind + shadcn/ui + Stripe + Resend**.

## Prerequisites

- Node.js 20+
- A Supabase project (cloud or local via `supabase` CLI)
- Stripe account (test mode is fine)
- Resend account (optional — emails are no-ops if `RESEND_API_KEY` is unset)

## Quick start

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
#   RESEND_API_KEY (optional)
#   NEXT_PUBLIC_APP_URL=http://localhost:3000

# 3. Apply database (cloud)
#    Open the SQL editor in Supabase Studio and run the migrations from
#    supabase/migrations/ in order, then supabase/seed.sql

#    OR locally with the Supabase CLI:
supabase start
supabase db reset  # runs migrations + seed

# 4. Run dev server
npm run dev   # http://localhost:3000
```

## What's inside

```
app/
  (marketing)/       — login, signup
  (app)/             — authenticated shell (sidebar + topbar)
    dashboard/       — KPIs, today's focus, alerts, activity
    orders/          — list, wizard, detail
    production/      — drag-and-drop Kanban (Realtime)
    customers/       — list, detail, create
    inventory/       — paper stocks, available qty, reorder badge
    products/        — catalog
    finishings/      — finishing options
    quotes/          — quotes list
    invoices/        — invoices list
    notifications/   — inbox
    settings/        — company / tax
    reports/         — revenue overview
  api/
    stripe/checkout  — create Checkout session
    stripe/webhook   — payment_intent → payments insert
    files/sign       — short-lived signed URL for storage objects
  auth/callback      — Supabase OAuth code exchange
  quote/approve/[token] — public approval page (no auth)

components/
  ui/                — shadcn-style primitives (Button, Card, Dialog, …)
  app/               — composite blocks (Sidebar, Topbar, KpiCard, StatusBadge, …)
  forms/             — DynamicForm renderer (drives product-specific specs)

lib/
  supabase/{client,server,admin}.ts
  permissions.ts     — role gating (customer < staff < manager < admin)
  pricing/calculate.ts — TS mirror of the SQL pricing trigger
  validators/index.ts — zod schemas
  stripe.ts, resend.ts

supabase/
  migrations/        — schema, RLS, views, storage buckets
  seed.sql           — demo products, papers, finishings, customers
  config.toml

types/database.ts    — typed table rows (placeholder; regenerate with supabase gen types)
```

## Roles & access

| Role     | Access                                                               |
|----------|----------------------------------------------------------------------|
| customer | Their own jobs, quotes, invoices, non-internal files                 |
| staff    | Full operations (orders, inventory, customers)                       |
| manager  | Staff + reports                                                      |
| admin    | Full access incl. products, finishings, settings, profiles           |

Enforced by RLS policies (`supabase/migrations/0002_rls.sql`) **and** server-side guards (`lib/permissions.ts`). Both layers must agree.

## Real-time features

- **Production Kanban** subscribes to the `jobs` table; status changes from any user appear instantly.
- **Notifications** insert into `notifications`; the database emits low-stock alerts to admins/managers via trigger.
- **Stock reservation** is enforced by a Postgres trigger that *raises an exception* on insufficient stock — preventing oversell at the data layer.

## Pricing engine

Single source of truth: `recalculate_job_costs()` SQL function in `0001_init.sql`.
Mirrored in TypeScript at `lib/pricing/calculate.ts` for live preview during order entry.
The two implementations are kept in sync; `tests/pricing.test.ts` locks down the formula.

```
paperCost     = paperCostPerSheet × paperQty
finishingCost = Σ (cost_per_unit × qty)
laborCost     = product.base_price
subtotalCost  = paper + finishing + labor
rushSurcharge = isRush ? subtotalCost × rush_multiplier : 0
totalCost     = subtotalCost + rushSurcharge
revenue       = unit_price × quantity
tax           = revenue × tax_rate
profit        = revenue − totalCost
margin        = profit / revenue
```

## Stripe webhook

Local development:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`.
Webhook inserts a row into `payments`; a database trigger updates the parent invoice's `amount_paid` and `status`.

## Scripts

```
npm run dev          Start dev server (Turbopack)
npm run build        Production build
npm run start        Start production server
npm run typecheck    tsc --noEmit
npm run db:types     Regenerate types/database.ts from the live schema
npm run db:reset     Drop & re-seed local Supabase
npm run db:push      Push migrations to linked project
npm test             Vitest unit tests (pricing engine)
npm run test:e2e     Playwright smoke tests
```

## Production checklist

- [ ] Set all env vars on Vercel (Supabase URL/keys, Stripe, Resend, APP_URL)
- [ ] Add Stripe webhook endpoint pointing at `/api/stripe/webhook` and copy the live signing secret
- [ ] Configure Supabase Auth redirect URLs to include `https://yourdomain.com/auth/callback`
- [ ] Verify a sending domain in Resend, set `RESEND_FROM`
- [ ] Run `npm run db:types` against the production project and commit the result
- [ ] Apply all migrations to the production Supabase project

## Excluded from v1 (by design)

Multi-currency • multi-shop • native mobile app • QuickBooks / Xero sync • shipping carrier integrations • AI assistant.
