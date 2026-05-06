import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/app/empty-state';
import { QuoteStatusBadge } from '@/components/app/status-badge';
import { SearchBar, FilterSelect, Pagination, ExportCsvButton } from '@/components/app/list-toolbar';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Quote } from '@/types/database';

const PER_PAGE = 25;
const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

export default async function QuotesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const status = sp.status ?? '';
  const archived = sp.archived === '1';
  const page = Math.max(1, Number(sp.page ?? 1));
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('quotes').select('*, customers(name, company)', { count: 'exact' });
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (status) query = query.eq('status', status);
  if (q) {
    const esc = q.replace(/[%,]/g, '');
    query = query.ilike('quote_number', `%${esc}%`);
  }
  query = query.order('created_at', { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  const { data: quotes, count } = await query.returns<(Quote & { customers: { name: string; company: string | null } })[]>();
  const total = count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Quotes" description="Customer-facing estimates with approval">
        <ExportCsvButton href="/api/exports/quotes" />
        <Button asChild><Link href="/quotes/new"><Plus className="h-4 w-4" />New Quote</Link></Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar placeholder="Search quote #…" />
        <FilterSelect paramName="status" label="Status" options={STATUSES} />
        <FilterSelect paramName="archived" label="View" options={[{ value: '1', label: 'Archived' }]} />
      </div>
      {!quotes?.length ? (
        <EmptyState icon={FileText} title={q || status ? 'No matches' : 'No quotes yet'} description={q || status ? 'Try clearing filters.' : 'Create a quote to send to a customer for approval.'} action={q || status ? undefined : { label: 'New quote', href: '/quotes/new' }} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Quote</th>
                <th className="px-4 py-2.5">Customer</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-mono text-xs text-primary">
                    <Link href={`/quotes/${q.id}`}>{q.quote_number}</Link>
                  </td>
                  <td className="px-4 py-2.5">{q.customers?.name}</td>
                  <td className="px-4 py-2.5 text-right tabular">{formatCurrency(q.total)}</td>
                  <td className="px-4 py-2.5"><QuoteStatusBadge status={q.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{q.sent_at ? formatDate(q.sent_at) : '—'}</td>
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
