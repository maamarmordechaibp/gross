import Link from 'next/link';
import { Plus, Package } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { JobStatusBadge, RushBadge } from '@/components/app/status-badge';
import { EmptyState } from '@/components/app/empty-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { JobFull } from '@/types/database';

export default async function OrdersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: jobs } = await supabase
    .from('v_job_full')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<JobFull[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="All print jobs">
        <Button asChild><Link href="/orders/new"><Plus className="h-4 w-4" />New Order</Link></Button>
      </PageHeader>

      {!jobs || jobs.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Create your first order to get production rolling."
          action={{ label: 'Create order', href: '/orders/new' }}
        />
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table */}
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
          {/* Mobile cards */}
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
        </Card>
      )}
    </div>
  );
}
