'use client';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { createQuoteAction } from '../actions';
import type { Customer } from '@/types/database';

interface Props {
  customers: Pick<Customer, 'id' | 'name' | 'company'>[];
  taxRate: number;
}

interface Line { description: string; qty: number; unit: number; }

const selectCls = 'flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function QuoteForm({ customers, taxRate }: Props) {
  const [pending, startTransition] = useTransition();
  const [customerId, setCustomerId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ description: '', qty: 1, unit: 0 }]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + (l.qty || 0) * (l.unit || 0), 0), [lines]);
  const tax = subtotal * (taxRate || 0);
  const total = subtotal + tax;

  function update(i: number, p: Partial<Line>) { setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...p } : l)); }
  function addLine() { setLines((ls) => [...ls, { description: '', qty: 1, unit: 0 }]); }
  function removeLine(i: number) { setLines((ls) => ls.filter((_, idx) => idx !== i)); }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = lines
      .filter((l) => l.description)
      .map((l) => ({
        description: l.description,
        qty: Number(l.qty) || 0,
        unit_price: Number(l.unit) || 0,
        total: (Number(l.qty) || 0) * (Number(l.unit) || 0),
      }));

    const fd = new FormData();
    fd.set('customer_id', customerId);
    fd.set('subtotal', String(subtotal));
    fd.set('tax', String(tax));
    fd.set('total', String(total));
    fd.set('notes', notes);
    fd.set('line_items', JSON.stringify(items));
    if (validUntil) fd.set('valid_until', new Date(validUntil).toISOString());

    startTransition(async () => {
      const res = await createQuoteAction(fd);
      if (res && !res.ok) toast.error(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Customer *</Label>
          <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectCls}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="valid_until">Valid until</Label>
          <Input id="valid_until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Line items</h3>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[1fr,90px,110px,110px,auto]">
              <div className="space-y-1"><Label className="text-xs">Description</Label>
                <Input value={l.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="500 Business Cards, full color" /></div>
              <div className="space-y-1"><Label className="text-xs">Qty</Label>
                <Input type="number" min={0} value={l.qty} onChange={(e) => update(i, { qty: e.target.valueAsNumber || 0 })} /></div>
              <div className="space-y-1"><Label className="text-xs">Unit</Label>
                <Input type="number" step="0.01" min={0} value={l.unit} onChange={(e) => update(i, { unit: e.target.valueAsNumber || 0 })} /></div>
              <div className="space-y-1"><Label className="text-xs">Subtotal</Label>
                <div className="flex h-9 items-center justify-end rounded-lg border bg-muted/30 px-3 text-sm tabular">{formatCurrency((l.qty||0)*(l.unit||0))}</div></div>
              <div className="flex items-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addLine} className="mt-2">
          <Plus className="h-3.5 w-3.5" /> Add line
        </Button>
      </div>

      <div className="space-y-1.5"><Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex justify-between text-sm"><span>Subtotal</span><span className="tabular">{formatCurrency(subtotal)}</span></div>
        <div className="flex justify-between text-sm"><span>Tax ({Math.round(taxRate*1000)/10}%)</span><span className="tabular">{formatCurrency(tax)}</span></div>
        <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold"><span>Total</span><span className="tabular">{formatCurrency(total)}</span></div>
      </div>

      <Button type="submit" disabled={pending || !customerId}>{pending ? 'Saving…' : 'Save quote'}</Button>
    </form>
  );
}
