-- =============================================================================
-- 0005_printer_assignment.sql — Add printer/press assignment to jobs
-- =============================================================================

alter table public.jobs
  add column if not exists printer text;

create index if not exists jobs_printer_idx on public.jobs (printer);

-- Optional: track "printed_at" so reports can show throughput per machine
alter table public.jobs
  add column if not exists printed_at timestamptz;
