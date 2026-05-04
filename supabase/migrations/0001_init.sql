-- =============================================================================
-- 0001_init.sql — Gross Printing ERP — core schema
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
-- profiles — extends auth.users
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
-- products — dynamic schema-driven
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
-- job_costs — recomputed via trigger
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
