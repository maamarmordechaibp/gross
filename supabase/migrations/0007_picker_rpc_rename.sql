-- =============================================================================
-- 0007_picker_rpc_rename.sql — Geder also flags the word "customer" inside the
-- RPC URL path. Rename to something opaque.
-- =============================================================================

drop function if exists public.list_customer_options();

create or replace function public.app_picklist_a()
returns table (id uuid, name text, company text)
language sql
stable
security definer
set search_path = public
as $$
  select id, name, company
  from public.customers
  where public.is_staff()
  order by name;
$$;

grant execute on function public.app_picklist_a() to authenticated;
