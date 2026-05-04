import Link from 'next/link';
import { ArrowRight, AlertTriangle, Boxes, Clock, DollarSign, Flame, PackageCheck, Plus, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { KpiCard } from '@/components/app/kpi-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { JobStatusBadge, RushBadge } from '@/components/app/status-badge';
import { EmptyState } from '@/components/app/empty-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate, relativeTime } from '@/lib/utils';
import type { DashboardKpis, JobFull } from '@/types/database';

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const [kpiRes, focusRes, alertsRes, activityRes] = await Promise.all([
    supabase.from('v_dashboard_kpis').select('*').maybeSingle<DashboardKpis>(),
    supabase
      .from('v_job_full')
      .select('*')
      .neq('status', 'completed')
      .neq('status', 'delivered')
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(8)
      .returns<JobFull[]>(),
    supabase
      .from('paper_stocks')
      .select('id,name,size,qty_on_hand,qty_reserved,reorder_threshold')
      .order('qty_on_hand', { ascending: true })
      .limit(5),
    supabase
      .from('activity_log')
      .select('id, action, entity_type, entity_id, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const { data: receivables } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, amount_paid, due_date, status, customers(name)')
    .in('status', ['sent', 'partial', 'overdue'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(6)
    .returns<Array<{ id: string; invoice_number: string; total: number; amount_paid: number; due_date: string | null; status: string; customers: { name: string } | null }>>();

  const k = kpiRes.data ?? {
    active_orders: 0, orders_due_today: 0, urgent_jobs: 0, completed_today: 0,
    overdue_jobs: 0, revenue_today: 0, revenue_week: 0, revenue_month: 0,
  };

  const focus = focusRes.data ?? [];
  const lowStock = (alertsRes.data ?? []).filter(
    (s: any) => s.qty_on_hand - s.qty_reserved <= s.reorder_threshold,
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Today at Gross Printing">
        <Button asChild><Link href="/orders/new"><Plus className="h-4 w-4" />New Order</Link></Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Active orders"     value={k.active_orders}     icon={PackageCheck} accent="primary" />
        <KpiCard label="Due today"         value={k.orders_due_today}  icon={Clock}        accent="warning" />
        <KpiCard label="Urgent jobs"       value={k.urgent_jobs}       icon={Flame}        accent="destructive" />
        <KpiCard label="Completed today"   value={k.completed_today}   icon={PackageCheck} accent="success" />
        <KpiCard label="Revenue today"     value={formatCurrency(k.revenue_today)} icon={DollarSign} accent="success" />
        <KpiCard label="Revenue this week" value={formatCurrency(k.revenue_week)}  icon={DollarSign} accent="primary" />
        <KpiCard label="Revenue this month"value={formatCurrency(k.revenue_month)} icon={DollarSign} accent="secondary" />
        <KpiCard label="Overdue"           value={k.overdue_jobs}      icon={AlertTriangle} accent="destructive" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-destructive" />Today Focus
              </CardTitle>
              <CardDescription>Most important jobs right now</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/production">View board <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {focus.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title="No active jobs"
                description="Create the first order to start production."
                action={{ label: 'Create order', href: '/orders/new' }}
              />
            ) : (
              <ul className="divide-y">
                {focus.map((j) => (
                  <li key={j.id}>
                    <Link
                      href={`/orders/${j.id}`}
                      className="flex items-center gap-3 py-2.5 transition-colors hover:bg-accent/50 -mx-2 px-2 rounded-md"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{j.job_number}</span>
                          <span className="truncate font-medium">{j.product_name}</span>
                          {j.is_rush && <RushBadge />}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {j.customer_name} · qty {j.quantity}
                          {j.due_date && <> · due {formatDate(j.due_date)}</>}
                        </div>
                      </div>
                      <JobStatusBadge status={j.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />Alerts
            </CardTitle>
            <CardDescription>Stock & production warnings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">All clear ✓</p>
            ) : (
              lowStock.map((s: any) => (
                <Link key={s.id} href="/inventory"
                  className="flex items-center gap-3 rounded-lg border bg-warning/5 px-3 py-2 text-sm hover:bg-warning/10">
                  <Boxes className="h-4 w-4 text-warning" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.name} <span className="text-xs text-muted-foreground">{s.size}</span></div>
                    <div className="text-xs text-muted-foreground">
                      {s.qty_on_hand - s.qty_reserved} available · threshold {s.reorder_threshold}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-warning" />Waiting on payment
          </CardTitle>
          <CardDescription>Open invoices — click to record a payment</CardDescription>
        </CardHeader>
        <CardContent>
          {!(receivables ?? []).length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">All invoices paid 🎉</p>
          ) : (
            <ul className="divide-y">
              {(receivables ?? []).map((inv) => {
                const outstanding = Number(inv.total) - Number(inv.amount_paid);
                const overdue = inv.due_date && new Date(inv.due_date) < new Date();
                return (
                  <li key={inv.id}>
                    <Link href={`/invoices/${inv.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent/50">
                      <span className="font-mono text-xs text-primary">{inv.invoice_number}</span>
                      <span className="flex-1 truncate">{inv.customers?.name ?? '—'}</span>
                      {overdue && <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">overdue</span>}
                      <span className="text-xs text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : 'no due'}</span>
                      <span className="tabular font-semibold">{formatCurrency(outstanding)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>What changed across the shop</CardDescription>
        </CardHeader>
        <CardContent>
          {(activityRes.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No activity yet</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(activityRes.data ?? []).map((a: any) => (
                <li key={a.id} className="flex items-center gap-3">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <span className="capitalize">{a.action}</span>
                  <span className="text-muted-foreground">on {a.entity_type}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{relativeTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
