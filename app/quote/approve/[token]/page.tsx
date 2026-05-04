import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { approveQuoteAction, rejectQuoteAction } from './actions';

export default async function QuoteApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: quote } = await supabase
    .from('quotes')
    .select('*, customers(name, company)')
    .eq('approval_token', token)
    .maybeSingle();
  if (!quote) notFound();

  const decided = quote.status === 'approved' || quote.status === 'rejected';

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 text-center">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Gross Printing</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Quote {quote.quote_number}</h1>
        <p className="mt-1 text-muted-foreground">For {quote.customers?.company ?? quote.customers?.name}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <Row k="Subtotal" v={formatCurrency(quote.subtotal)} />
          <Row k="Tax" v={formatCurrency(quote.tax)} />
          <div className="border-t pt-3">
            <Row k="Total" v={formatCurrency(quote.total)} bold />
          </div>
          {quote.expires_at && (
            <p className="text-xs text-muted-foreground">Valid until {formatDate(quote.expires_at)}</p>
          )}
        </CardContent>
      </Card>

      {decided ? (
        <p className="mt-6 text-center text-sm font-medium capitalize">This quote has been {quote.status}.</p>
      ) : (
        <div className="mt-6 flex gap-3">
          <form action={approveQuoteAction} className="flex-1">
            <input type="hidden" name="token" value={token} />
            <Button type="submit" className="w-full">Approve quote</Button>
          </form>
          <form action={rejectQuoteAction} className="flex-1">
            <input type="hidden" name="token" value={token} />
            <Button type="submit" variant="outline" className="w-full">Decline</Button>
          </form>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'text-base font-semibold' : ''}`}>
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular">{v}</span>
    </div>
  );
}
