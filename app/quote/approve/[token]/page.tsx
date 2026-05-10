import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { approveQuoteAction, rejectQuoteAction } from './actions';

interface LineItem { description: string; qty: number; unit_price: number; total: number }

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
  const items: LineItem[] = Array.isArray(quote.line_items) ? (quote.line_items as LineItem[]) : [];

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 text-center">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Gross Printing</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Quote {quote.quote_number}</h1>
        <p className="mt-1 text-muted-foreground">For {quote.customers?.company ?? quote.customers?.name}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          {items.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((it, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{it.description}</td>
                      <td className="px-3 py-2 text-right tabular">{it.qty}</td>
                      <td className="px-3 py-2 text-right tabular">{formatCurrency(it.unit_price)}</td>
                      <td className="px-3 py-2 text-right tabular">{formatCurrency(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {quote.notes && (
            <div>
              <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Notes</div>
              <pre className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm font-sans">{quote.notes}</pre>
            </div>
          )}

          <Row k="Subtotal" v={formatCurrency(quote.subtotal)} />
          <Row k="Tax" v={formatCurrency(quote.tax)} />
          <div className="border-t pt-3">
            <Row k="Total" v={formatCurrency(quote.total)} bold />
          </div>
          {quote.valid_until && (
            <p className="text-xs text-muted-foreground">Valid until {formatDate(quote.valid_until)}</p>
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
