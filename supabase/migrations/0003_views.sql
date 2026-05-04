-- =============================================================================
-- 0003_views.sql — Reporting views
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
