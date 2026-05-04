-- =============================================================================
-- 0002_rls.sql — Row-Level Security policies
-- =============================================================================

-- Helper: current role
create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean language sql stable as $$
  select public.current_role() in ('staff','manager','admin')
$$;
create or replace function public.is_manager() returns boolean language sql stable as $$
  select public.current_role() in ('manager','admin')
$$;
create or replace function public.is_admin() returns boolean language sql stable as $$
  select public.current_role() = 'admin'
$$;

-- Resolve customer_id linked to current profile
create or replace function public.current_customer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select customer_id from public.profiles where id = auth.uid()
$$;

-- Enable RLS on all tables
alter table public.profiles          enable row level security;
alter table public.customers         enable row level security;
alter table public.products          enable row level security;
alter table public.paper_stocks      enable row level security;
alter table public.paper_receipts    enable row level security;
alter table public.finishing_options enable row level security;
alter table public.jobs              enable row level security;
alter table public.job_finishings    enable row level security;
alter table public.job_stage_history enable row level security;
alter table public.job_costs         enable row level security;
alter table public.quotes            enable row level security;
alter table public.invoices          enable row level security;
alter table public.payments          enable row level security;
alter table public.files             enable row level security;
alter table public.file_versions     enable row level security;
alter table public.notifications     enable row level security;
alter table public.activity_log      enable row level security;
alter table public.settings          enable row level security;

-- ---- profiles --------------------------------------------------------------
create policy "profiles self read"   on public.profiles for select using (auth.uid() = id or public.is_staff());
create policy "profiles self update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
create policy "profiles admin all"   on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- ---- customers -------------------------------------------------------------
create policy "customers staff read" on public.customers for select using (public.is_staff() or id = public.current_customer_id());
create policy "customers staff write" on public.customers for all using (public.is_staff()) with check (public.is_staff());

-- ---- products / finishings (read-public to authed; admin writes) -----------
create policy "products read auth" on public.products for select using (auth.role() = 'authenticated');
create policy "products admin write" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "finishings read auth" on public.finishing_options for select using (auth.role() = 'authenticated');
create policy "finishings admin write" on public.finishing_options for all using (public.is_admin()) with check (public.is_admin());

-- ---- paper_stocks / receipts (staff read, manager+ write) ------------------
create policy "paper read staff" on public.paper_stocks for select using (public.is_staff());
create policy "paper write manager" on public.paper_stocks for all using (public.is_manager()) with check (public.is_manager());

create policy "receipts read staff" on public.paper_receipts for select using (public.is_staff());
create policy "receipts write manager" on public.paper_receipts for all using (public.is_manager()) with check (public.is_manager());

-- ---- jobs ------------------------------------------------------------------
create policy "jobs staff read"  on public.jobs for select using (public.is_staff() or customer_id = public.current_customer_id());
create policy "jobs staff write" on public.jobs for all using (public.is_staff()) with check (public.is_staff());

create policy "jobfin staff read"  on public.job_finishings for select using (
  public.is_staff() or job_id in (select id from public.jobs where customer_id = public.current_customer_id())
);
create policy "jobfin staff write" on public.job_finishings for all using (public.is_staff()) with check (public.is_staff());

create policy "stagehist staff read" on public.job_stage_history for select using (public.is_staff());
create policy "stagehist staff write" on public.job_stage_history for all using (public.is_staff()) with check (public.is_staff());

create policy "jobcosts staff read" on public.job_costs for select using (public.is_staff());
create policy "jobcosts admin write" on public.job_costs for all using (public.is_manager()) with check (public.is_manager());

-- ---- quotes ----------------------------------------------------------------
create policy "quotes staff read"  on public.quotes for select using (public.is_staff() or customer_id = public.current_customer_id());
create policy "quotes staff write" on public.quotes for all using (public.is_staff()) with check (public.is_staff());

-- ---- invoices / payments ---------------------------------------------------
create policy "invoices staff read"  on public.invoices for select using (public.is_staff() or customer_id = public.current_customer_id());
create policy "invoices staff write" on public.invoices for all using (public.is_staff()) with check (public.is_staff());

create policy "payments staff read"  on public.payments for select using (
  public.is_staff() or invoice_id in (select id from public.invoices where customer_id = public.current_customer_id())
);
create policy "payments staff write" on public.payments for all using (public.is_staff()) with check (public.is_staff());

-- ---- files -----------------------------------------------------------------
create policy "files read" on public.files for select using (
  public.is_staff()
  or (owner_type = 'customer' and owner_id = public.current_customer_id() and not is_internal)
  or (owner_type = 'job'      and owner_id in (select id from public.jobs     where customer_id = public.current_customer_id()) and not is_internal)
  or (owner_type = 'quote'    and owner_id in (select id from public.quotes   where customer_id = public.current_customer_id()) and not is_internal)
  or (owner_type = 'invoice'  and owner_id in (select id from public.invoices where customer_id = public.current_customer_id()) and not is_internal)
);
create policy "files staff write" on public.files for all using (public.is_staff()) with check (public.is_staff());

create policy "fileversions staff read"  on public.file_versions for select using (public.is_staff());
create policy "fileversions staff write" on public.file_versions for all using (public.is_staff()) with check (public.is_staff());

-- ---- notifications ---------------------------------------------------------
create policy "notif self read"   on public.notifications for select using (user_id = auth.uid());
create policy "notif self update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notif staff write" on public.notifications for insert with check (public.is_staff());
create policy "notif self delete" on public.notifications for delete using (user_id = auth.uid() or public.is_admin());

-- ---- activity_log ----------------------------------------------------------
create policy "activity admin read" on public.activity_log for select using (public.is_manager());
create policy "activity insert any" on public.activity_log for insert with check (auth.uid() is not null);

-- ---- settings --------------------------------------------------------------
create policy "settings read auth"  on public.settings for select using (auth.role() = 'authenticated');
create policy "settings admin write" on public.settings for all using (public.is_admin()) with check (public.is_admin());
