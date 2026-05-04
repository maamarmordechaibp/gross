-- Combined Supabase setup for Gross Printing
-- Paste this into Supabase Studio → SQL Editor → New query, then Run.

-- ============================================================
-- migrations\0001_init.sql
-- ============================================================
-- =============================================================================
-- 0001_init.sql â€” Gross Printing ERP â€” core schema
-- =============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---- Enums ------------------------------------------------------------------
create type user_role           as enum ('customer','staff','manager','admin');
create type job_status          as enum ('estimate','prepress','printing','finishing','completed','delivered','cancelled');
create type job_priority        as enum ('low','normal','high','urgent');
create type quote_status        as enum ('draft','sent','approved','rejected','expired');
create type invoice_status      as enum ('draft','sent','partial','paid','void');
create type finishing_type      as enum ('cutting','folding','laminating','binding','scoring','perforating','embossing','foiling','other');
create type file_owner_type     as enum ('job','customer','quote','invoice');
create type notification_type   as enum ('order_created','status_change','quote_ready','invoice_paid','low_stock','file_uploaded','assignment','generic');

-- ---- Helper: updated_at trigger --------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =============================================================================
-- profiles â€” extends auth.users
-- =============================================================================
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null default 'customer',
  full_name       text,
  phone           text,
  avatar_url      text,
  customer_id     uuid,                       -- if role=customer, link to customers row
  stripe_customer_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Auto-create profile on auth signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================================
-- customers
-- =============================================================================
create table public.customers (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  company         text,
  email           text,
  phone           text,
  billing_address jsonb,
  notes           text,
  stripe_customer_id text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.customers (lower(name));
create index on public.customers (lower(email));
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.tg_set_updated_at();

alter table public.profiles
  add constraint profiles_customer_fk foreign key (customer_id) references public.customers(id) on delete set null;

-- =============================================================================
-- products â€” dynamic schema-driven
-- =============================================================================
create table public.products (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  slug            text unique not null,
  category        text,
  description     text,
  default_specs   jsonb not null default '{}'::jsonb,
  schema          jsonb not null default '{}'::jsonb,  -- dynamic form schema
  base_price      numeric(12,2) not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_products_updated before update on public.products
  for each row execute function public.tg_set_updated_at();

-- =============================================================================
-- paper_stocks + receipts
-- =============================================================================
create table public.paper_stocks (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  size            text not null,             -- e.g. "A4", "12x18"
  weight_gsm      int,
  color           text,
  finish          text,
  qty_on_hand     int  not null default 0,
  qty_reserved    int  not null default 0,
  reorder_threshold int not null default 100,
  cost_per_sheet  numeric(10,4) not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint paper_qty_nonneg check (qty_on_hand >= 0 and qty_reserved >= 0)
);
create trigger trg_paper_updated before update on public.paper_stocks
  for each row execute function public.tg_set_updated_at();

create table public.paper_receipts (
  id              uuid primary key default uuid_generate_v4(),
  paper_stock_id  uuid not null references public.paper_stocks(id) on delete cascade,
  qty             int not null check (qty > 0),
  unit_cost       numeric(10,4) not null default 0,
  supplier        text,
  reference       text,
  received_at     timestamptz not null default now(),
  received_by     uuid references public.profiles(id)
);

-- Increase stock on receipt
create or replace function public.tg_apply_paper_receipt()
returns trigger language plpgsql as $$
begin
  update public.paper_stocks
    set qty_on_hand = qty_on_hand + new.qty,
        cost_per_sheet = case when paper_stocks.qty_on_hand + new.qty > 0
          then ((paper_stocks.cost_per_sheet * paper_stocks.qty_on_hand) + (new.unit_cost * new.qty))
               / (paper_stocks.qty_on_hand + new.qty)
          else new.unit_cost end
    where id = new.paper_stock_id;
  return new;
end $$;
create trigger trg_paper_receipt_apply
  after insert on public.paper_receipts
  for each row execute function public.tg_apply_paper_receipt();

-- =============================================================================
-- finishing_options
-- =============================================================================
create table public.finishing_options (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  type            finishing_type not null,
  cost_per_unit   numeric(10,4) not null default 0,
  machine         text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_finishing_updated before update on public.finishing_options
  for each row execute function public.tg_set_updated_at();

-- =============================================================================
-- jobs (orders)
-- =============================================================================
create sequence if not exists job_number_seq start 1001;

create table public.jobs (
  id              uuid primary key default uuid_generate_v4(),
  job_number      text not null unique default ('JOB-' || lpad(nextval('job_number_seq')::text, 6, '0')),
  customer_id     uuid not null references public.customers(id) on delete restrict,
  product_id      uuid not null references public.products(id) on delete restrict,
  status          job_status not null default 'estimate',
  priority        job_priority not null default 'normal',
  is_rush         boolean not null default false,
  due_date        timestamptz,
  quantity        int not null check (quantity > 0),
  unit_price      numeric(12,4) not null default 0,
  specs           jsonb not null default '{}'::jsonb,
  paper_stock_id  uuid references public.paper_stocks(id) on delete restrict,
  paper_qty       int not null default 0 check (paper_qty >= 0),
  assigned_to     uuid references public.profiles(id) on delete set null,
  notes           text,
  internal_notes  text,
  parent_job_id   uuid references public.jobs(id) on delete set null,  -- for reorder/duplicate
  template_name   text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.jobs (status);
create index on public.jobs (customer_id);
create index on public.jobs (assigned_to);
create index on public.jobs (due_date);
create trigger trg_jobs_updated before update on public.jobs
  for each row execute function public.tg_set_updated_at();

create table public.job_finishings (
  job_id              uuid not null references public.jobs(id) on delete cascade,
  finishing_option_id uuid not null references public.finishing_options(id) on delete restrict,
  qty                 int not null default 1 check (qty > 0),
  primary key (job_id, finishing_option_id)
);

-- ---- Stock reservation -----------------------------------------------------
create or replace function public.tg_jobs_reserve_stock()
returns trigger language plpgsql as $$
declare
  available int;
begin
  if new.paper_stock_id is null or new.paper_qty = 0 then return new; end if;

  if (TG_OP = 'INSERT') then
    select qty_on_hand - qty_reserved into available
      from public.paper_stocks where id = new.paper_stock_id for update;
    if available < new.paper_qty then
      raise exception 'Insufficient paper stock: % available, % required', available, new.paper_qty;
    end if;
    update public.paper_stocks set qty_reserved = qty_reserved + new.paper_qty
      where id = new.paper_stock_id;

  elsif (TG_OP = 'UPDATE') then
    -- Release on terminal status; reserve diff otherwise
    if old.status not in ('completed','delivered','cancelled')
       and new.status in ('completed','delivered','cancelled') then
      update public.paper_stocks
         set qty_on_hand  = qty_on_hand  - old.paper_qty,
             qty_reserved = qty_reserved - old.paper_qty
       where id = old.paper_stock_id;
    elsif old.paper_stock_id is distinct from new.paper_stock_id
       or old.paper_qty <> new.paper_qty then
      if old.paper_stock_id is not null then
        update public.paper_stocks set qty_reserved = qty_reserved - old.paper_qty
          where id = old.paper_stock_id;
      end if;
      select qty_on_hand - qty_reserved into available
        from public.paper_stocks where id = new.paper_stock_id for update;
      if available < new.paper_qty then
        raise exception 'Insufficient paper stock for change: % available, % required', available, new.paper_qty;
      end if;
      update public.paper_stocks set qty_reserved = qty_reserved + new.paper_qty
        where id = new.paper_stock_id;
    end if;
  end if;
  return new;
end $$;
create trigger trg_jobs_reserve_stock
  before insert or update on public.jobs
  for each row execute function public.tg_jobs_reserve_stock();

-- =============================================================================
-- job_costs â€” recomputed via trigger
-- =============================================================================
create table public.job_costs (
  job_id          uuid primary key references public.jobs(id) on delete cascade,
  paper_cost      numeric(12,2) not null default 0,
  finishing_cost  numeric(12,2) not null default 0,
  rush_surcharge  numeric(12,2) not null default 0,
  labor_cost      numeric(12,2) not null default 0,
  total_cost      numeric(12,2) not null default 0,
  revenue         numeric(12,2) not null default 0,
  profit          numeric(12,2) not null default 0,
  margin_pct      numeric(6,2)  not null default 0,
  updated_at      timestamptz not null default now()
);

create or replace function public.recalculate_job_costs(p_job_id uuid)
returns void language plpgsql as $$
declare
  j               public.jobs%rowtype;
  v_paper_cost    numeric(12,2) := 0;
  v_finish_cost   numeric(12,2) := 0;
  v_labor_cost    numeric(12,2) := 0;
  v_revenue       numeric(12,2) := 0;
  v_rush          numeric(12,2) := 0;
  v_total         numeric(12,2);
  v_profit        numeric(12,2);
  v_margin        numeric(6,2)  := 0;
  v_rush_mult     numeric       := 0.25;
begin
  select * into j from public.jobs where id = p_job_id;
  if not found then return; end if;

  if j.paper_stock_id is not null then
    select coalesce(cost_per_sheet,0) * j.paper_qty into v_paper_cost
      from public.paper_stocks where id = j.paper_stock_id;
  end if;

  select coalesce(sum(fo.cost_per_unit * jf.qty),0) into v_finish_cost
    from public.job_finishings jf
    join public.finishing_options fo on fo.id = jf.finishing_option_id
   where jf.job_id = p_job_id;

  select coalesce(base_price,0) into v_labor_cost from public.products where id = j.product_id;

  v_revenue := j.unit_price * j.quantity;
  if j.is_rush then v_rush := round((v_paper_cost + v_finish_cost + v_labor_cost) * v_rush_mult, 2); end if;
  v_total  := v_paper_cost + v_finish_cost + v_labor_cost + v_rush;
  v_profit := v_revenue - v_total;
  if v_revenue > 0 then v_margin := round(v_profit / v_revenue * 100, 2); end if;

  insert into public.job_costs(job_id, paper_cost, finishing_cost, rush_surcharge, labor_cost,
                               total_cost, revenue, profit, margin_pct, updated_at)
  values (p_job_id, v_paper_cost, v_finish_cost, v_rush, v_labor_cost,
          v_total, v_revenue, v_profit, v_margin, now())
  on conflict (job_id) do update set
    paper_cost = excluded.paper_cost,
    finishing_cost = excluded.finishing_cost,
    rush_surcharge = excluded.rush_surcharge,
    labor_cost = excluded.labor_cost,
    total_cost = excluded.total_cost,
    revenue = excluded.revenue,
    profit = excluded.profit,
    margin_pct = excluded.margin_pct,
    updated_at = now();
end $$;

create or replace function public.tg_jobs_recalc()
returns trigger language plpgsql as $$
begin
  perform public.recalculate_job_costs(coalesce(new.id, old.id));
  return coalesce(new, old);
end $$;
create trigger trg_jobs_recalc_costs
  after insert or update on public.jobs
  for each row execute function public.tg_jobs_recalc();

create or replace function public.tg_job_finishings_recalc()
returns trigger language plpgsql as $$
begin
  perform public.recalculate_job_costs(coalesce(new.job_id, old.job_id));
  return coalesce(new, old);
end $$;
create trigger trg_job_finishings_recalc
  after insert or update or delete on public.job_finishings
  for each row execute function public.tg_job_finishings_recalc();

-- =============================================================================
-- job_stage_history
-- =============================================================================
create table public.job_stage_history (
  id              uuid primary key default uuid_generate_v4(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  from_status     job_status,
  to_status       job_status not null,
  by_user         uuid references public.profiles(id),
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  duration_seconds int generated always as (
    case when ended_at is not null then extract(epoch from (ended_at - started_at))::int else null end
  ) stored
);

create or replace function public.tg_jobs_stage_history()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT') then
    insert into public.job_stage_history(job_id, from_status, to_status, by_user)
    values (new.id, null, new.status, new.created_by);
  elsif (TG_OP = 'UPDATE') and old.status is distinct from new.status then
    update public.job_stage_history set ended_at = now()
      where job_id = new.id and ended_at is null;
    insert into public.job_stage_history(job_id, from_status, to_status, by_user)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;
create trigger trg_jobs_stage_history
  after insert or update on public.jobs
  for each row execute function public.tg_jobs_stage_history();

-- =============================================================================
-- quotes
-- =============================================================================
create sequence if not exists quote_number_seq start 1001;
create table public.quotes (
  id              uuid primary key default uuid_generate_v4(),
  quote_number    text not null unique default ('QT-' || lpad(nextval('quote_number_seq')::text, 6, '0')),
  customer_id     uuid not null references public.customers(id) on delete restrict,
  job_id          uuid references public.jobs(id) on delete set null,
  status          quote_status not null default 'draft',
  subtotal        numeric(12,2) not null default 0,
  tax             numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  notes           text,
  approval_token  text unique default encode(gen_random_bytes(24), 'hex'),
  valid_until     timestamptz,
  sent_at         timestamptz,
  decided_at      timestamptz,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_quotes_updated before update on public.quotes
  for each row execute function public.tg_set_updated_at();

-- =============================================================================
-- invoices + payments
-- =============================================================================
create sequence if not exists invoice_number_seq start 1001;
create table public.invoices (
  id              uuid primary key default uuid_generate_v4(),
  invoice_number  text not null unique default ('INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0')),
  customer_id     uuid not null references public.customers(id) on delete restrict,
  job_id          uuid references public.jobs(id) on delete set null,
  status          invoice_status not null default 'draft',
  subtotal        numeric(12,2) not null default 0,
  tax             numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  amount_paid     numeric(12,2) not null default 0,
  due_date        timestamptz,
  stripe_payment_intent_id text,
  notes           text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.invoices (status);
create index on public.invoices (customer_id);
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function public.tg_set_updated_at();

create table public.payments (
  id              uuid primary key default uuid_generate_v4(),
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  amount          numeric(12,2) not null check (amount > 0),
  method          text not null default 'stripe',
  stripe_charge_id text,
  paid_at         timestamptz not null default now(),
  recorded_by     uuid references public.profiles(id),
  notes           text
);

-- Auto-update invoice status / amount_paid when payments change
create or replace function public.tg_payments_apply()
returns trigger language plpgsql as $$
declare
  v_total numeric(12,2);
  v_paid  numeric(12,2);
  v_inv   uuid;
begin
  v_inv := coalesce(new.invoice_id, old.invoice_id);
  select total into v_total from public.invoices where id = v_inv;
  select coalesce(sum(amount),0) into v_paid from public.payments where invoice_id = v_inv;
  update public.invoices
     set amount_paid = v_paid,
         status = case
           when v_paid <= 0 then status
           when v_paid >= v_total then 'paid'::invoice_status
           else 'partial'::invoice_status end
   where id = v_inv;
  return coalesce(new, old);
end $$;
create trigger trg_payments_apply
  after insert or update or delete on public.payments
  for each row execute function public.tg_payments_apply();

-- =============================================================================
-- files + versions
-- =============================================================================
create table public.files (
  id              uuid primary key default uuid_generate_v4(),
  owner_type      file_owner_type not null,
  owner_id        uuid not null,
  storage_path    text not null,           -- bucket key
  bucket          text not null default 'job-files',
  name            text not null,
  mime            text,
  size            bigint,
  version         int not null default 1,
  is_internal     boolean not null default false,
  uploaded_by     uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);
create index on public.files (owner_type, owner_id);

create table public.file_versions (
  id              uuid primary key default uuid_generate_v4(),
  file_id         uuid not null references public.files(id) on delete cascade,
  version         int  not null,
  storage_path    text not null,
  size            bigint,
  uploaded_by     uuid references public.profiles(id),
  uploaded_at     timestamptz not null default now()
);

-- =============================================================================
-- notifications + activity_log
-- =============================================================================
create table public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  type            notification_type not null default 'generic',
  title           text not null,
  body            text,
  link            text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.notifications (user_id, read_at);

create table public.activity_log (
  id              uuid primary key default uuid_generate_v4(),
  actor_id        uuid references public.profiles(id) on delete set null,
  entity_type     text not null,
  entity_id       uuid,
  action          text not null,
  diff            jsonb,
  created_at      timestamptz not null default now()
);
create index on public.activity_log (entity_type, entity_id);
create index on public.activity_log (actor_id);

-- Low-stock notification (broadcasts to all admins/managers)
create or replace function public.tg_low_stock_alert()
returns trigger language plpgsql as $$
begin
  if (new.qty_on_hand - new.qty_reserved) <= new.reorder_threshold
     and (old.qty_on_hand - old.qty_reserved) > old.reorder_threshold then
    insert into public.notifications(user_id, type, title, body, link)
    select p.id, 'low_stock', 'Low stock: ' || new.name,
           'Available ' || (new.qty_on_hand - new.qty_reserved) || ' / threshold ' || new.reorder_threshold,
           '/inventory'
      from public.profiles p where p.role in ('admin','manager');
  end if;
  return new;
end $$;
create trigger trg_paper_low_stock
  after update on public.paper_stocks
  for each row execute function public.tg_low_stock_alert();

-- =============================================================================
-- settings (singleton)
-- =============================================================================
create table public.settings (
  id              int primary key default 1 check (id = 1),
  company_name    text not null default 'Gross Printing',
  company_email   text,
  company_phone   text,
  company_address jsonb,
  currency        text not null default 'USD',
  tax_rate        numeric(5,4) not null default 0.0875,
  rush_multiplier numeric(5,4) not null default 0.25,
  updated_at      timestamptz not null default now()
);
insert into public.settings(id) values (1) on conflict do nothing;
create trigger trg_settings_updated before update on public.settings
  for each row execute function public.tg_set_updated_at();


-- ============================================================
-- migrations\0002_rls.sql
-- ============================================================
-- =============================================================================
-- 0002_rls.sql â€” Row-Level Security policies
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


-- ============================================================
-- migrations\0003_views.sql
-- ============================================================
-- =============================================================================
-- 0003_views.sql â€” Reporting views
-- =============================================================================

create or replace view public.v_dashboard_kpis as
select
  (select count(*) from public.jobs where status not in ('completed','delivered','cancelled')) as active_orders,
  (select count(*) from public.jobs where due_date::date = current_date and status not in ('completed','delivered','cancelled')) as orders_due_today,
  (select count(*) from public.jobs where (is_rush or priority='urgent') and status not in ('completed','delivered','cancelled')) as urgent_jobs,
  (select count(*) from public.jobs where status='completed' and updated_at::date = current_date) as completed_today,
  (select count(*) from public.jobs where due_date < now() and status not in ('completed','delivered','cancelled')) as overdue_jobs,
  (select coalesce(sum(amount),0) from public.payments where paid_at::date = current_date) as revenue_today,
  (select coalesce(sum(amount),0) from public.payments where paid_at >= date_trunc('week', current_date)) as revenue_week,
  (select coalesce(sum(amount),0) from public.payments where paid_at >= date_trunc('month', current_date)) as revenue_month;

create or replace view public.v_job_full as
select
  j.*,
  c.name as customer_name,
  c.company as customer_company,
  c.email as customer_email,
  p.name as product_name,
  p.slug as product_slug,
  ps.name as paper_name,
  ps.size as paper_size,
  jc.paper_cost,
  jc.finishing_cost,
  jc.rush_surcharge,
  jc.labor_cost,
  jc.total_cost,
  jc.revenue,
  jc.profit,
  jc.margin_pct,
  pr.full_name as assignee_name
from public.jobs j
join public.customers c on c.id = j.customer_id
join public.products  p on p.id = j.product_id
left join public.paper_stocks ps on ps.id = j.paper_stock_id
left join public.job_costs jc on jc.job_id = j.id
left join public.profiles pr on pr.id = j.assigned_to;

create or replace view public.v_staff_workload as
select
  pr.id as user_id,
  pr.full_name,
  count(*) filter (where j.status not in ('completed','delivered','cancelled')) as active_jobs,
  count(*) filter (where j.is_rush and j.status not in ('completed','delivered','cancelled')) as rush_jobs,
  count(*) filter (where j.due_date < now() and j.status not in ('completed','delivered','cancelled')) as overdue_jobs
from public.profiles pr
left join public.jobs j on j.assigned_to = pr.id
where pr.role in ('staff','manager')
group by pr.id, pr.full_name;


-- ============================================================
-- migrations\0004_storage.sql
-- ============================================================
-- =============================================================================
-- 0004_storage.sql â€” Storage buckets and policies
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('job-files', 'job-files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Staff: full access on job-files
create policy "job-files staff all"
on storage.objects for all
using (bucket_id = 'job-files' and public.is_staff())
with check (bucket_id = 'job-files' and public.is_staff());

-- Customers: read their own non-internal files (path convention: <owner_type>/<owner_id>/...)
create policy "job-files customer read"
on storage.objects for select
using (
  bucket_id = 'job-files'
  and exists (
    select 1 from public.files f
    where f.storage_path = storage.objects.name
      and f.is_internal = false
      and (
        (f.owner_type = 'customer' and f.owner_id = public.current_customer_id())
        or (f.owner_type = 'job'     and f.owner_id in (select id from public.jobs     where customer_id = public.current_customer_id()))
        or (f.owner_type = 'quote'   and f.owner_id in (select id from public.quotes   where customer_id = public.current_customer_id()))
        or (f.owner_type = 'invoice' and f.owner_id in (select id from public.invoices where customer_id = public.current_customer_id()))
      )
  )
);

-- Avatars (public bucket, owner-only write)
create policy "avatars read all"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "avatars owner write"
on storage.objects for insert
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner update"
on storage.objects for update
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================================
-- seed.sql
-- ============================================================
-- =============================================================================
-- seed.sql â€” Demo data for Gross Printing
-- Run after `supabase db reset` (which applies migrations).
-- =============================================================================

-- Products with dynamic form schemas
insert into public.products (name, slug, category, description, base_price, default_specs, schema) values
('Business Cards', 'business-cards', 'Cards',
 'Standard 3.5x2 business cards with bleed.', 25.00,
 '{"size":"3.5x2","bleed":"0.125","sides":"double"}'::jsonb,
 '{"fields":[
    {"key":"sides","label":"Sides","type":"select","options":["single","double"],"required":true},
    {"key":"corners","label":"Corners","type":"select","options":["square","rounded"]},
    {"key":"finish","label":"Finish","type":"select","options":["matte","gloss","uncoated"]}
  ]}'::jsonb),
('Flyers', 'flyers', 'Marketing',
 'Single or double-sided flyers, multiple sizes.', 40.00,
 '{"size":"8.5x11","sides":"single"}'::jsonb,
 '{"fields":[
    {"key":"size","label":"Size","type":"select","options":["4x6","5.5x8.5","8.5x11","11x17"],"required":true},
    {"key":"sides","label":"Sides","type":"select","options":["single","double"]}
  ]}'::jsonb),
('Booklets', 'booklets', 'Books',
 'Saddle-stitched or perfect-bound booklets.', 120.00,
 '{"page_count":16,"binding":"saddle-stitch"}'::jsonb,
 '{"fields":[
    {"key":"page_count","label":"Page Count","type":"number","min":4,"required":true},
    {"key":"binding","label":"Binding","type":"select","options":["saddle-stitch","perfect-bound","spiral","wire-o"],"required":true},
    {"key":"cover_type","label":"Cover","type":"select","options":["self","100lb-gloss","cardstock"]}
  ]}'::jsonb),
('Posters', 'posters', 'Large Format',
 'Wide-format posters up to 36x48.', 60.00,
 '{"size":"18x24"}'::jsonb,
 '{"fields":[
    {"key":"size","label":"Size","type":"select","options":["12x18","18x24","24x36","36x48"],"required":true},
    {"key":"laminate","label":"Laminate","type":"select","options":["none","matte","gloss"]}
  ]}'::jsonb)
on conflict (slug) do nothing;

-- Paper stocks
insert into public.paper_stocks (name, size, weight_gsm, color, finish, qty_on_hand, reorder_threshold, cost_per_sheet) values
('100lb Gloss Cover', '12x18', 270, 'White', 'Gloss', 5000, 500, 0.18),
('100lb Matte Text',  '12x18', 148, 'White', 'Matte', 8000, 800, 0.09),
('80lb Uncoated',     '8.5x11', 120, 'Natural', 'Uncoated', 12000, 1000, 0.04),
('14pt Cardstock',    '12x18', 350, 'White', 'Matte', 3000, 400, 0.22)
on conflict do nothing;

-- Finishings
insert into public.finishing_options (name, type, cost_per_unit, machine) values
('Cut to size',         'cutting',     0.02, 'Polar 92'),
('Score & fold',        'folding',     0.05, 'MBO B26'),
('Lamination â€” matte',  'laminating',  0.15, 'GMP Saturn'),
('Saddle-stitch bind',  'binding',     0.45, 'Heidelberg ST'),
('Perfect bind',        'binding',     1.20, 'Horizon BQ-270'),
('Round corners',       'cutting',     0.04, 'Lassco CR-50'),
('UV spot coating',     'other',       0.30, 'Scodix')
on conflict do nothing;

-- Demo customers
insert into public.customers (name, company, email, phone) values
('Alex Rivera',  'Rivera Studios',     'alex@riverastudios.com',  '+1-555-0142'),
('Maya Chen',    'Northwind Press',    'maya@northwindpress.com', '+1-555-0188'),
('Sam Patel',    'Patel & Co.',        'sam@patelco.com',         '+1-555-0210')
on conflict do nothing;



