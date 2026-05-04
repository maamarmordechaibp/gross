import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuoteStatusBadge } from '@/components/app/status-badge';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Quote } from '@/types/database';
import { SendQuoteButton } from './send-button';

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: q } = await supabase
    .from('quotes')
    .select('*, customers(name, company, email)')
    .eq('id', id)
    .maybeSingle<Quote & { customers: { name: string; company: string | null; email: string | null } }>();
  if (!q) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const approveUrl = q.approval_token ? `${baseUrl}/quote/approve?token=${q.approval_token}` : null;

  return (
    <div className="space-y-6">
      <PageHeader title={q.quote_number} description={q.customers.name}>
        <Button asChild variant="outline" size="sm">
          <Link href="/quotes"><ArrowLeft className="h-3.5 w-3.5" />Back</Link>
        </Button>
        {q.status === 'draft' && <SendQuoteButton quoteId={q.id} />}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <QuoteStatusBadge status={q.status} />
        {q.sent_at && <span className="text-sm text-muted-foreground">Sent {formatDate(q.sent_at)}</span>}
        {q.valid_until && <span className="text-sm text-muted-foreground">Valid until {formatDate(q.valid_until)}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div><div className="text-xs uppercase tracking-wider text-muted-foreground">Customer</div>
                <div className="font-medium">{q.customers.name}{q.customers.company ? ` — ${q.customers.company}` : ''}</div>
                <div className="text-xs text-muted-foreground">{q.customers.email ?? 'no email on file'}</div>
              </div>
              <div><div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
                <div className="text-lg font-semibold tabular">{formatCurrency(q.total)}</div>
              </div>
            </div>
            {q.notes && (
              <div>
                <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Items / notes</div>
                <pre className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm font-sans">{q.notes}</pre>
              </div>
            )}
            {approveUrl && (
              <div className="rounded-lg border bg-card p-3 text-xs">
                <div className="font-medium">Customer approval link</div>
                <a href={approveUrl} className="break-all text-primary underline">{approveUrl}</a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:h-fit">
          <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular">{formatCurrency(q.subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="tabular">{formatCurrency(q.tax)}</span></div>
            <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span className="tabular">{formatCurrency(q.total)}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
