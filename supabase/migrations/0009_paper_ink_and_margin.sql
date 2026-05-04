-- =============================================================================
-- Per-paper ink rates + global margin setting
-- =============================================================================

alter table public.paper_stocks
  add column if not exists bw_ink_per_side    numeric(10,4) not null default 0.015,
  add column if not exists color_ink_per_side numeric(10,4) not null default 0.08;

comment on column public.paper_stocks.bw_ink_per_side is
  'Cost (USD) to print one side of this stock in black & white (toner/ink + amortization).';
comment on column public.paper_stocks.color_ink_per_side is
  'Cost (USD) to print one side of this stock in full color.';

alter table public.settings
  add column if not exists default_margin_pct numeric(6,4) not null default 1.00;

comment on column public.settings.default_margin_pct is
  'Default markup applied on top of unit cost. e.g. 1.00 = +100%, 0.50 = +50%. The auto-price tier table is multiplied against this baseline.';
