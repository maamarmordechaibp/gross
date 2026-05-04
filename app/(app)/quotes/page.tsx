import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/app/empty-state';
import { QuoteStatusBadge } from '@/components/app/status-badge';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Quote } from '@/types/database';

export default async function QuotesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: quotes } = await supabase
    .from('quotes')
    .select('*, customers(name, company)')
    .order('created_at', { ascending: false })
    .returns<(Quote & { customers: { name: string; company: string | null } })[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="Quotes" description="Customer-facing estimates with approval">
        <Button asChild><Link href="/quotes/new"><Plus className="h-4 w-4" />New Quote</Link></Button>
      </PageHeader>
      {!quotes?.length ? (
        <EmptyState icon={FileText} title="No quotes yet" description="Create a quote to send to a customer for approval." action={{ label: 'New quote', href: '/quotes/new' }} />
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
        </Card>
      )}
    </div>
  );
}
