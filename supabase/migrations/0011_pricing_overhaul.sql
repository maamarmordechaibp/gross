-- Pricing model overhaul:
--   * Per-paper ink rates split by (color × sides) — 4 explicit values.
--   * Margin is tiered by quantity (volume discount) instead of a single flat margin.
--   * The product's base_price no longer counts as "labor / setup cost" — it's
--     just an optional starting point in the UI; cost = paper + ink + finishing.

-- 1. Four explicit ink rates per paper stock.
alter table public.paper_stocks
  add column if not exists ink_bw_1side    numeric(10,4) not null default 0.015,
  add column if not exists ink_bw_2side    numeric(10,4) not null default 0.030,
  add column if not exists ink_color_1side numeric(10,4) not null default 0.080,
  add column if not exists ink_color_2side numeric(10,4) not null default 0.160;

-- Backfill from old per-side fields when present (best-effort).
update public.paper_stocks
   set ink_bw_1side    = coalesce(bw_ink_per_side,    ink_bw_1side),
       ink_bw_2side    = coalesce(bw_ink_per_side,    ink_bw_2side / 2) * 2,
       ink_color_1side = coalesce(color_ink_per_side, ink_color_1side),
       ink_color_2side = coalesce(color_ink_per_side, ink_color_2side / 2) * 2
 where bw_ink_per_side is not null or color_ink_per_side is not null;

-- 2. Tiered margin in settings (jsonb of {min_qty, margin_pct}).
--    margin_pct is a decimal: 1.0 = 100% markup (sell price = 2 × cost).
alter table public.settings
  add column if not exists margin_tiers jsonb not null default
    '[{"min_qty":0,"margin_pct":1.0},{"min_qty":100,"margin_pct":0.6},{"min_qty":500,"margin_pct":0.4},{"min_qty":1000,"margin_pct":0.3}]'::jsonb;
