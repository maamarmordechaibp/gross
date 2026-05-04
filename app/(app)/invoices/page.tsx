import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/app/empty-state';
import { InvoiceStatusBadge } from '@/components/app/status-badge';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice } from '@/types/database';

export default async function InvoicesPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('invoices')
    .select('*, customers(name)')
    .order('created_at', { ascending: false })
    .returns<(Invoice & { customers: { name: string } })[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Billing & payments">
        <Button asChild><Link href="/invoices/new"><Plus className="h-4 w-4" />New Invoice</Link></Button>
      </PageHeader>
      {!data?.length ? (
        <EmptyState icon={Receipt} title="No invoices yet" description="Auto-generate invoices from completed orders." action={{ label: 'Create invoice', href: '/invoices/new' }} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Invoice</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5 text-right">Paid</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((i) => (
                <tr key={i.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">
                    <Link href={`/invoices/${i.id}`}>{i.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-2.5">{i.customers?.name}</td>
                  <td className="px-4 py-2.5 text-right tabular">{formatCurrency(i.total)}</td>
                  <td className="px-4 py-2.5 text-right tabular text-muted-foreground">{formatCurrency(i.amount_paid)}</td>
                  <td className="px-4 py-2.5"><InvoiceStatusBadge status={i.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{i.due_date ? formatDate(i.due_date) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
