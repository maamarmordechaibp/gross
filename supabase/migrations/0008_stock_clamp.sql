-- =============================================================================
-- 0008_stock_clamp.sql — Prevent paper_qty_nonneg constraint from blocking
-- job completion when on-hand stock tracking is behind reality. Clamp the
-- on_hand/reserved deductions at zero instead of raising.
-- =============================================================================

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
    -- Release on terminal status; clamp at zero so out-of-sync stock doesn't
    -- block the workflow.
    if old.status not in ('completed','delivered','cancelled')
       and new.status in ('completed','delivered','cancelled') then
      update public.paper_stocks
         set qty_on_hand  = greatest(0, qty_on_hand  - old.paper_qty),
             qty_reserved = greatest(0, qty_reserved - old.paper_qty)
       where id = old.paper_stock_id;
    elsif old.paper_stock_id is distinct from new.paper_stock_id
       or old.paper_qty <> new.paper_qty then
      if old.paper_stock_id is not null then
        update public.paper_stocks
           set qty_reserved = greatest(0, qty_reserved - old.paper_qty)
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
