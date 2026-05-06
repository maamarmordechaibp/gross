import Link from 'next/link';
import { Plus, Package } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { JobStatusBadge, RushBadge } from '@/components/app/status-badge';
import { EmptyState } from '@/components/app/empty-state';
import { SearchBar, FilterSelect, Pagination, ExportCsvButton } from '@/components/app/list-toolbar';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { JobFull } from '@/types/database';

const PER_PAGE = 25;
const STATUS_OPTIONS = [
  { value: 'estimate', label: 'Estimate' },
  { value: 'queued', label: 'Queued' },
  { value: 'in_production', label: 'In production' },
  { value: 'completed', label: 'Completed' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const status = sp.status ?? '';
  const rush = sp.rush ?? '';
  const page = Math.max(1, Number(sp.page ?? 1));
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('v_job_full').select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (rush === '1') query = query.eq('is_rush', true);
  if (q) {
    const esc = q.replace(/[%,]/g, '');
    query = query.or(`job_number.ilike.%${esc}%,customer_name.ilike.%${esc}%,product_name.ilike.%${esc}%`);
  }
  query = query.order('created_at', { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const { data: jobs, count } = await query.returns<JobFull[]>();
  const total = count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="All print jobs">
        <ExportCsvButton href="/api/exports/orders" />
        <Button asChild><Link href="/orders/new"><Plus className="h-4 w-4" />New Order</Link></Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar placeholder="Search job #, customer, product…" />
        <FilterSelect paramName="status" label="Status" options={STATUS_OPTIONS} />
        <FilterSelect paramName="rush" label="Rush" options={[{ value: '1', label: 'Rush only' }]} />
      </div>

      {!jobs || jobs.length === 0 ? (
        <EmptyState
          icon={Package}
          title={q || status || rush ? 'No matches' : 'No orders yet'}
          description={q || status || rush ? 'Try clearing the filters.' : 'Create your first order to get production rolling.'}
          action={q || status || rush ? undefined : { label: 'Create order', href: '/orders/new' }}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5">Job</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Product</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5">Due</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/orders/${j.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                        {j.job_number}
                      </Link>
                      {j.is_rush && <span className="ml-2"><RushBadge /></span>}
                    </td>
                    <td className="px-4 py-2.5">{j.customer_name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{j.product_name}</td>
                    <td className="px-4 py-2.5 text-right tabular">{j.quantity}</td>
                    <td className="px-4 py-2.5 text-right tabular">{formatCurrency(j.revenue ?? 0)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{j.due_date ? formatDate(j.due_date) : '—'}</td>
                    <td className="px-4 py-2.5"><JobStatusBadge status={j.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y md:hidden">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/orders/${j.id}`} className="block p-4 hover:bg-accent/40">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{j.job_number}</span>
                    <JobStatusBadge status={j.status} />
                  </div>
                  <div className="mt-1 font-medium">{j.product_name}</div>
                  <div className="text-xs text-muted-foreground">{j.customer_name} · qty {j.quantity}</div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{j.due_date ? formatDate(j.due_date) : 'No due date'}</span>
                    <span className="tabular font-medium">{formatCurrency(j.revenue ?? 0)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} perPage={PER_PAGE} total={total} />
        </Card>
      )}
    </div>
  );
}
