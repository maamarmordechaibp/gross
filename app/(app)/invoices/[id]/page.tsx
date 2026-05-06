import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InvoiceStatusBadge } from '@/components/app/status-badge';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice } from '@/types/database';
import { InvoiceActions } from './invoice-actions';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase
    .from('invoices')
    .select('*, customers(name, company, email)')
    .eq('id', id)
    .maybeSingle<Invoice & { customers: { name: string; company: string | null; email: string | null } }>();
  if (!inv) notFound();

  const { data: payments } = await supabase
    .from('payments').select('*').eq('invoice_id', id).order('paid_at', { ascending: false });

  const outstanding = Number(inv.total) - Number(inv.amount_paid);

  return (
    <div className="space-y-6">
      <PageHeader title={inv.invoice_number} description={inv.customers.name}>
        <Button asChild variant="outline" size="sm">
          <Link href="/invoices"><ArrowLeft className="h-3.5 w-3.5" />Back</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/print/invoices/${inv.id}`} target="_blank"><Printer className="h-3.5 w-3.5" />Print</Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <InvoiceStatusBadge status={inv.status} />
        {inv.due_date && <span className="text-sm text-muted-foreground">Due {formatDate(inv.due_date)}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Customer</div>
                <div className="font-medium">{inv.customers.name}{inv.customers.company ? ` — ${inv.customers.company}` : ''}</div>
                <div className="text-xs text-muted-foreground">{inv.customers.email ?? 'no email on file'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</div>
                <div className="text-lg font-semibold tabular">{formatCurrency(outstanding)}</div>
              </div>
            </div>
            {inv.notes && (
              <div>
                <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Items / notes</div>
                <pre className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm font-sans">{inv.notes}</pre>
              </div>
            )}
            {payments && payments.length > 0 && (
              <div>
                <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Payments</div>
                <ul className="divide-y rounded-lg border">
                  {payments.map((p) => (
                    <li key={p.id} className="flex justify-between p-2 text-sm">
                      <span>{formatDate(p.paid_at)} <span className="text-muted-foreground">· {p.method}</span></span>
                      <span className="tabular font-medium">{formatCurrency(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span className="tabular">{formatCurrency(inv.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="tabular">{formatCurrency(inv.tax)}</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span className="tabular">{formatCurrency(inv.total)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Paid</span><span className="tabular">{formatCurrency(inv.amount_paid)}</span></div>
              <div className="flex justify-between border-t pt-2 font-semibold"><span>Outstanding</span><span className="tabular">{formatCurrency(outstanding)}</span></div>
            </CardContent>
          </Card>
          {outstanding > 0 && <InvoiceActions invoiceId={inv.id} outstanding={outstanding} />}
        </div>
      </div>
    </div>
  );
}
