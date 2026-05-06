import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import type { DashboardKpis } from '@/types/database';

interface JobRow {
  id: string;
  product_id: string | null;
  customer_id: string;
  status: string;
  revenue: number;
  total_cost: number;
  profit: number;
  margin_pct: number;
  created_at: string;
}

interface InvoiceRow {
  id: string;
  customer_id: string;
  total: number;
  amount_paid: number;
  due_date: string | null;
  status: string;
}

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const since = new Date(); since.setDate(since.getDate() - 90);
  const sinceIso = since.toISOString();

  const [{ data: kpis }, { data: jobs }, { data: invoices }, { data: products }, { data: customers }] = await Promise.all([
    supabase.from('v_dashboard_kpis').select('*').maybeSingle<DashboardKpis>(),
    supabase.from('v_job_full').select('id, product_id, customer_id, status, revenue, total_cost, profit, margin_pct, created_at').gte('created_at', sinceIso).returns<JobRow[]>(),
    supabase.from('invoices').select('id, customer_id, total, amount_paid, due_date, status').neq('status', 'void').neq('status', 'paid').returns<InvoiceRow[]>(),
    supabase.from('products').select('id, name'),
    supabase.from('customers').select('id, name, company'),
  ]);

  const productMap = new Map<string, string>((products ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
  const customerMap = new Map<string, string>((customers ?? []).map((c: { id: string; name: string; company: string | null }) => [c.id, c.company ? `${c.name} — ${c.company}` : c.name]));

  const byProduct = new Map<string, { revenue: number; profit: number; jobs: number }>();
  for (const j of jobs ?? []) {
    const key = j.product_id ?? '—';
    const cur = byProduct.get(key) ?? { revenue: 0, profit: 0, jobs: 0 };
    cur.revenue += Number(j.revenue ?? 0); cur.profit += Number(j.profit ?? 0); cur.jobs += 1;
    byProduct.set(key, cur);
  }
  const productRows = Array.from(byProduct.entries())
    .map(([id, v]) => ({ name: productMap.get(id) ?? '—', ...v, margin: v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const byCustomer = new Map<string, { revenue: number; jobs: number }>();
  for (const j of jobs ?? []) {
    const cur = byCustomer.get(j.customer_id) ?? { revenue: 0, jobs: 0 };
    cur.revenue += Number(j.revenue ?? 0); cur.jobs += 1;
    byCustomer.set(j.customer_id, cur);
  }
  const customerRows = Array.from(byCustomer.entries())
    .map(([id, v]) => ({ name: customerMap.get(id) ?? '—', ...v }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const buckets = { current: 0, '0-30': 0, '30-60': 0, '60-90': 0, '90+': 0 };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const inv of invoices ?? []) {
    const outstanding = Number(inv.total) - Number(inv.amount_paid);
    if (outstanding <= 0) continue;
    if (!inv.due_date) { buckets.current += outstanding; continue; }
    const due = new Date(inv.due_date);
    const daysPast = Math.floor((today.getTime() - due.getTime()) / 86400000);
    if (daysPast <= 0) buckets.current += outstanding;
    else if (daysPast <= 30) buckets['0-30'] += outstanding;
    else if (daysPast <= 60) buckets['30-60'] += outstanding;
    else if (daysPast <= 90) buckets['60-90'] += outstanding;
    else buckets['90+'] += outstanding;
  }
  const totalAR = Object.values(buckets).reduce((a, b) => a + b, 0);

  const totalRevenue90 = (jobs ?? []).reduce((s, j) => s + Number(j.revenue ?? 0), 0);
  const totalProfit90 = (jobs ?? []).reduce((s, j) => s + Number(j.profit ?? 0), 0);
  const overallMargin = totalRevenue90 > 0 ? (totalProfit90 / totalRevenue90) * 100 : 0;

  const arBuckets: Array<[string, number, string]> = [
    ['Current', buckets.current, 'bg-emerald-50 text-emerald-700'],
    ['0-30 days', buckets['0-30'], 'bg-amber-50 text-amber-700'],
    ['30-60 days', buckets['30-60'], 'bg-orange-50 text-orange-700'],
    ['60-90 days', buckets['60-90'], 'bg-red-50 text-red-700'],
    ['90+ days', buckets['90+'], 'bg-rose-100 text-rose-800'],
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Performance & financial overview" />
      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Today</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular">{formatCurrency(kpis?.revenue_today ?? 0)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Week</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular">{formatCurrency(kpis?.revenue_week ?? 0)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Month</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular">{formatCurrency(kpis?.revenue_month ?? 0)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">90-day margin</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular">{overallMargin.toFixed(1)}%</CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top products (last 90 days)</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="text-left">Product</th><th className="text-right">Jobs</th><th className="text-right">Revenue</th><th className="text-right">Margin</th></tr></thead>
              <tbody className="divide-y">
                {productRows.length === 0 ? (<tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No data</td></tr>)
                  : productRows.map((r) => (
                    <tr key={r.name}><td className="p-2">{r.name}</td><td className="p-2 text-right tabular">{r.jobs}</td><td className="p-2 text-right tabular">{formatCurrency(r.revenue)}</td><td className="p-2 text-right tabular">{r.margin.toFixed(1)}%</td></tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top customers (last 90 days)</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="text-left">Customer</th><th className="text-right">Jobs</th><th className="text-right">Revenue</th></tr></thead>
              <tbody className="divide-y">
                {customerRows.length === 0 ? (<tr><td colSpan={3} className="p-3 text-center text-muted-foreground">No data</td></tr>)
                  : customerRows.map((r) => (
                    <tr key={r.name}><td className="p-2">{r.name}</td><td className="p-2 text-right tabular">{r.jobs}</td><td className="p-2 text-right tabular">{formatCurrency(r.revenue)}</td></tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Accounts receivable aging</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-5">
            {arBuckets.map(([label, value, cls]) => (
              <div key={label} className={`rounded-lg p-3 ${cls}`}>
                <div className="text-xs uppercase tracking-wider opacity-70">{label}</div>
                <div className="text-lg font-semibold tabular">{formatCurrency(value)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-muted-foreground">Total outstanding: <span className="font-semibold tabular text-foreground">{formatCurrency(totalAR)}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
