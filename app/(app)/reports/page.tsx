import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import type { DashboardKpis } from '@/types/database';

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: kpis } = await supabase.from('v_dashboard_kpis').select('*').maybeSingle<DashboardKpis>();

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Performance & financial overview" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardTitle>Today</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular">{formatCurrency(kpis?.revenue_today ?? 0)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Week</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular">{formatCurrency(kpis?.revenue_week ?? 0)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Month</CardTitle></CardHeader><CardContent className="text-2xl font-semibold tabular">{formatCurrency(kpis?.revenue_month ?? 0)}</CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Coming soon</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Charts: revenue trend, profit margin per product, staff workload, bottleneck heatmap.</CardContent>
      </Card>
    </div>
  );
}
