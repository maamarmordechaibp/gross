-- =============================================================================
-- Quotes carry the full job spec so they can be converted to a job on approval.
-- =============================================================================

alter table public.quotes
  add column if not exists spec jsonb;

comment on column public.quotes.spec is
  'Full job payload (customer_id, product_id, quantity, unit_price, paper_stock_id, paper_qty, finishings, etc.) used to materialize a job when the quote is approved.';
