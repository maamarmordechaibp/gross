-- =============================================================================
-- 0012_archive_indexes_line_items.sql
--   * Soft-delete (archived_at) on user-facing entities
--   * created_at indexes for fast list sorting
--   * Quote line_items JSON for richer customer-facing emails / detail views
--   * Job cancel_reason + parent_job_id index for reorder lookups
-- =============================================================================

-- ---- Soft-delete columns ----------------------------------------------------
alter table public.customers          add column if not exists archived_at timestamptz;
alter table public.products           add column if not exists archived_at timestamptz;
alter table public.paper_stocks       add column if not exists archived_at timestamptz;
alter table public.finishing_options  add column if not exists archived_at timestamptz;
alter table public.quotes             add column if not exists archived_at timestamptz;
alter table public.invoices           add column if not exists archived_at timestamptz;

-- Allow only non-archived to satisfy unique slug / business uniqueness if needed.
-- (Products.slug already unique; archive does not collide.)

-- ---- created_at indexes for list sort --------------------------------------
create index if not exists idx_customers_created_at on public.customers (created_at desc);
create index if not exists idx_products_created_at  on public.products  (created_at desc);
create index if not exists idx_jobs_created_at      on public.jobs      (created_at desc);
create index if not exists idx_quotes_created_at    on public.quotes    (created_at desc);
create index if not exists idx_invoices_created_at  on public.invoices  (created_at desc);
create index if not exists idx_paper_stocks_name    on public.paper_stocks (name);

-- Common search filters
create index if not exists idx_jobs_status_due      on public.jobs (status, due_date);
create index if not exists idx_invoices_status_due  on public.invoices (status, due_date);
create index if not exists idx_quotes_status        on public.quotes (status);

-- For "duplicate / reorder" lookup
create index if not exists idx_jobs_parent          on public.jobs (parent_job_id);
create index if not exists idx_jobs_customer_status on public.jobs (customer_id, status);

-- ---- Quote line_items + cancel_reason on jobs ------------------------------
alter table public.quotes
  add column if not exists line_items jsonb not null default '[]'::jsonb;

alter table public.jobs
  add column if not exists cancel_reason text;

-- ---- Recompute archived-aware view to keep list pages clean ----------------
-- (Apps filter by archived_at is null themselves; views unchanged.)
