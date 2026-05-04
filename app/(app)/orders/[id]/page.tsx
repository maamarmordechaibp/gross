import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, User, Package } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JobStatusBadge, RushBadge } from '@/components/app/status-badge';
import { PriceBreakdownCard } from '@/components/app/price-breakdown';
import { JobFiles } from '@/components/app/job-files';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isStaff } from '@/lib/supabase/role';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { JobFull } from '@/types/database';
import type { PriceBreakdown } from '@/lib/pricing/calculate';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: job } = await supabase
    .from('v_job_full')
    .select('*')
    .eq('id', id)
    .maybeSingle<JobFull>();

  if (!job) notFound();

  const staff = await isStaff();

  const { data: files } = await supabase
    .from('files')
    .select('id, name, size, mime, storage_path, created_at')
    .eq('owner_type', 'job').eq('owner_id', id)
    .order('created_at', { ascending: false });

  const breakdown: PriceBreakdown = {
    paperCost: Number(job.paper_cost ?? 0),
    finishingCost: Number(job.finishing_cost ?? 0),
    laborCost: Number(job.labor_cost ?? 0),
    rushSurcharge: Number(job.rush_surcharge ?? 0),
    totalCost: Number(job.total_cost ?? 0),
    revenue: Number(job.revenue ?? 0),
    tax: 0,
    grandTotal: Number(job.revenue ?? 0),
    profit: Number(job.profit ?? 0),
    marginPct: Number(job.margin_pct ?? 0),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${job.product_name} · ${job.job_number}`}
        description={`${job.customer_name} · qty ${job.quantity}`}
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/orders"><ArrowLeft className="h-3.5 w-3.5" />All orders</Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <JobStatusBadge status={job.status} />
        {job.is_rush && <RushBadge />}
        <span className="text-sm text-muted-foreground">Created {formatDate(job.created_at)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Job details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Detail icon={User} label="Customer" value={job.customer_name} />
              <Detail icon={Package} label="Product" value={job.product_name} />
              <Detail icon={Calendar} label="Due date" value={job.due_date ? formatDate(job.due_date) : '—'} />
              <Detail icon={User} label="Assignee" value={job.assignee_name ?? 'Unassigned'} />
              {staff && <Detail label="Paper" value={job.paper_name ? `${job.paper_name} (${job.paper_size})` : '—'} />}
              {staff && <Detail label="Paper qty" value={String(job.paper_qty ?? 0)} />}
            </CardContent>
          </Card>

          {Object.keys(job.specs ?? {}).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(job.specs as Record<string, unknown>).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                      <dd className="text-sm font-medium">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}

          {job.notes && (
            <Card>
              <CardHeader><CardTitle>Customer notes</CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-line text-sm">{job.notes}</p></CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Files</CardTitle></CardHeader>
            <CardContent>
              <JobFiles jobId={job.id} files={files ?? []} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <PriceBreakdownCard breakdown={breakdown} showInternals={staff} />
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}{label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
