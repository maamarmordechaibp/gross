import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArchiveButton } from '@/components/app/archive-button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updatePaperStockAction, archivePaperStockAction, receivePaperStockAction } from '../actions';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PaperStock } from '@/types/database';

async function update(formData: FormData) {
  'use server';
  await updatePaperStockAction(formData);
}

async function receive(formData: FormData) {
  'use server';
  await receivePaperStockAction(formData);
}

export default async function PaperStockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: stock }, { data: receipts }] = await Promise.all([
    supabase.from('paper_stocks').select('*').eq('id', id).maybeSingle<PaperStock>(),
    supabase.from('paper_receipts').select('id, qty, unit_cost, supplier, reference, created_at').eq('paper_stock_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  if (!stock) notFound();
  const avail = stock.qty_on_hand - stock.qty_reserved;
  const low = avail <= stock.reorder_threshold;

  return (
    <div className="space-y-6">
      <PageHeader title={stock.name} description={`${stock.size}${stock.color ? ' · ' + stock.color : ''}${stock.finish ? ' · ' + stock.finish : ''}`}>
        <Button asChild variant="outline" size="sm"><Link href="/inventory"><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
        <ArchiveButton action={archivePaperStockAction} hiddenFields={{ id: stock.id }} redirectTo="/inventory" />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">On hand</div><div className="text-lg font-semibold tabular">{stock.qty_on_hand.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">Reserved</div><div className="text-lg font-semibold tabular">{stock.qty_reserved.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">Available</div><div className="text-lg font-semibold tabular">{avail.toLocaleString()}</div><Badge className="mt-1" variant={low ? 'warning' : 'success'}>{low ? 'Low' : 'OK'}</Badge></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">Avg cost / sheet</div><div className="text-lg font-semibold tabular">{formatCurrency(stock.cost_per_sheet)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Receive stock</CardTitle></CardHeader>
        <CardContent>
          <form action={receive} className="grid gap-4 sm:grid-cols-4">
            <input type="hidden" name="paper_stock_id" value={stock.id} />
            <div className="space-y-1.5"><Label htmlFor="qty">Quantity *</Label><Input id="qty" name="qty" type="number" min={1} required /></div>
            <div className="space-y-1.5"><Label htmlFor="unit_cost">Unit cost</Label><Input id="unit_cost" name="unit_cost" type="number" step="0.0001" min={0} /></div>
            <div className="space-y-1.5"><Label htmlFor="supplier">Supplier</Label><Input id="supplier" name="supplier" /></div>
            <div className="space-y-1.5"><Label htmlFor="reference">PO #</Label><Input id="reference" name="reference" /></div>
            <Button type="submit" className="sm:col-span-4 sm:w-fit">Record receipt</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Edit stock</CardTitle></CardHeader>
        <CardContent>
          <form action={update} className="space-y-4">
            <input type="hidden" name="id" value={stock.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={stock.name} /></div>
              <div className="space-y-1.5"><Label htmlFor="size">Size</Label><Input id="size" name="size" defaultValue={stock.size} /></div>
              <div className="space-y-1.5"><Label htmlFor="weight_gsm">Weight (gsm)</Label><Input id="weight_gsm" name="weight_gsm" type="number" min={0} defaultValue={stock.weight_gsm ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="color">Color</Label><Input id="color" name="color" defaultValue={stock.color ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="finish">Finish</Label><Input id="finish" name="finish" defaultValue={stock.finish ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="reorder_threshold">Reorder threshold</Label><Input id="reorder_threshold" name="reorder_threshold" type="number" min={0} defaultValue={stock.reorder_threshold} /></div>
              <div className="space-y-1.5"><Label htmlFor="ink_bw_1side">Ink B&amp;W 1 side</Label><Input id="ink_bw_1side" name="ink_bw_1side" type="number" step="0.0001" min={0} defaultValue={stock.ink_bw_1side} /></div>
              <div className="space-y-1.5"><Label htmlFor="ink_bw_2side">Ink B&amp;W 2 sides</Label><Input id="ink_bw_2side" name="ink_bw_2side" type="number" step="0.0001" min={0} defaultValue={stock.ink_bw_2side} /></div>
              <div className="space-y-1.5"><Label htmlFor="ink_color_1side">Ink color 1 side</Label><Input id="ink_color_1side" name="ink_color_1side" type="number" step="0.0001" min={0} defaultValue={stock.ink_color_1side} /></div>
              <div className="space-y-1.5"><Label htmlFor="ink_color_2side">Ink color 2 sides</Label><Input id="ink_color_2side" name="ink_color_2side" type="number" step="0.0001" min={0} defaultValue={stock.ink_color_2side} /></div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={stock.active !== false} /> Active
            </label>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent receipts</CardTitle></CardHeader>
        <CardContent>
          {!receipts?.length ? <p className="text-sm text-muted-foreground">No receipts yet.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr>
                <th className="py-1.5">Date</th><th className="py-1.5">Qty</th><th className="py-1.5">Unit cost</th><th className="py-1.5">Supplier</th><th className="py-1.5">Reference</th>
              </tr></thead>
              <tbody className="divide-y">
                {receipts.map((r: { id: string; qty: number; unit_cost: number; supplier: string | null; reference: string | null; created_at: string }) => (
                  <tr key={r.id}>
                    <td className="py-1.5 text-muted-foreground">{formatDate(r.created_at)}</td>
                    <td className="py-1.5 tabular">{r.qty.toLocaleString()}</td>
                    <td className="py-1.5 tabular">{formatCurrency(r.unit_cost)}</td>
                    <td className="py-1.5 text-muted-foreground">{r.supplier ?? '—'}</td>
                    <td className="py-1.5 text-muted-foreground">{r.reference ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
