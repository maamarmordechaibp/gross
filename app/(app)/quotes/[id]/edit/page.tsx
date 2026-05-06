import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateQuoteAction } from '../../actions';
import type { Quote } from '@/types/database';

async function update(formData: FormData) {
  'use server';
  await updateQuoteAction(formData);
}

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: q } = await supabase.from('quotes').select('*').eq('id', id).maybeSingle<Quote>();
  if (!q) notFound();
  if (q.status !== 'draft') redirect(`/quotes/${id}`);

  const lineItemsJson = JSON.stringify(q.line_items ?? [], null, 2);

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${q.quote_number}`} description="Adjust line items, totals, or notes before sending.">
        <Button asChild variant="outline" size="sm"><Link href={`/quotes/${q.id}`}><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
      </PageHeader>
      <Card className="max-w-3xl">
        <CardHeader><CardTitle>Quote details</CardTitle></CardHeader>
        <CardContent>
          <form action={update} className="space-y-4">
            <input type="hidden" name="id" value={q.id} />
            <input type="hidden" name="customer_id" value={q.customer_id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5"><Label htmlFor="subtotal">Subtotal</Label><Input id="subtotal" name="subtotal" type="number" step="0.01" min={0} defaultValue={q.subtotal} /></div>
              <div className="space-y-1.5"><Label htmlFor="tax">Tax</Label><Input id="tax" name="tax" type="number" step="0.01" min={0} defaultValue={q.tax} /></div>
              <div className="space-y-1.5"><Label htmlFor="total">Total</Label><Input id="total" name="total" type="number" step="0.01" min={0} defaultValue={q.total} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="valid_until">Valid until</Label><Input id="valid_until" name="valid_until" type="date" defaultValue={q.valid_until ?? ''} /></div>
            <div className="space-y-1.5">
              <Label htmlFor="line_items">Line items (JSON)</Label>
              <Textarea id="line_items" name="line_items" rows={8} defaultValue={lineItemsJson} className="font-mono text-xs" />
              <p className="text-xs text-muted-foreground">Array of {`{ description, qty, unit_price, total }`}</p>
            </div>
            <div className="space-y-1.5"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={3} defaultValue={q.notes ?? ''} /></div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
