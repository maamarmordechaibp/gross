import Link from 'next/link';
import { Plus, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/app/empty-state';
import { InvoiceStatusBadge } from '@/components/app/status-badge';
import { SearchBar, FilterSelect, Pagination, ExportCsvButton } from '@/components/app/list-toolbar';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice } from '@/types/database';

const PER_PAGE = 25;
const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'void', label: 'Void' },
];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const status = sp.status ?? '';
  const archived = sp.archived === '1';
  const page = Math.max(1, Number(sp.page ?? 1));
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('invoices').select('*, customers(name)', { count: 'exact' });
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (status) query = query.eq('status', status);
  if (q) {
    const esc = q.replace(/[%,]/g, '');
    query = query.ilike('invoice_number', `%${esc}%`);
  }
  query = query.order('created_at', { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  const { data, count } = await query.returns<(Invoice & { customers: { name: string } })[]>();
  const total = count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Billing & payments">
        <ExportCsvButton href="/api/exports/invoices" />
        <Button asChild><Link href="/invoices/new"><Plus className="h-4 w-4" />New Invoice</Link></Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar placeholder="Search invoice #…" />
        <FilterSelect paramName="status" label="Status" options={STATUSES} />
        <FilterSelect paramName="archived" label="View" options={[{ value: '1', label: 'Archived' }]} />
      </div>
      {!data?.length ? (
        <EmptyState icon={Receipt} title={q || status ? 'No matches' : 'No invoices yet'} description={q || status ? 'Try clearing filters.' : 'Auto-generate invoices from completed orders.'} action={q || status ? undefined : { label: 'Create invoice', href: '/invoices/new' }} />
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
          <Pagination page={page} perPage={PER_PAGE} total={total} />
        </Card>
      )}
    </div>
  );
}
