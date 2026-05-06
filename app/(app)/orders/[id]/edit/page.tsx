import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateJobAction } from '../../actions';

const selectCls = 'flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

async function update(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  const payload = {
    quantity: Number(formData.get('quantity') ?? 0),
    unit_price: Number(formData.get('unit_price') ?? 0),
    paper_qty: Number(formData.get('paper_qty') ?? 0),
    due_date: (formData.get('due_date') as string) || null,
    priority: (formData.get('priority') as 'low' | 'normal' | 'high' | 'urgent') || 'normal',
    is_rush: formData.get('is_rush') === 'on',
    notes: (formData.get('notes') as string) || null,
    internal_notes: (formData.get('internal_notes') as string) || null,
    paper_stock_id: (formData.get('paper_stock_id') as string) || null,
  };
  const fd = new FormData();
  fd.set('id', id);
  fd.set('payload', JSON.stringify({ ...payload, finishings: [] }));
  await updateJobAction(fd);
}

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: job }, { data: papers }] = await Promise.all([
    supabase.from('jobs').select('*').eq('id', id).maybeSingle<{
      id: string; quantity: number; unit_price: number; paper_qty: number;
      due_date: string | null; priority: 'low' | 'normal' | 'high' | 'urgent';
      is_rush: boolean; notes: string | null; internal_notes: string | null;
      paper_stock_id: string | null; job_number: string;
    }>(),
    supabase.from('paper_stocks').select('id, name').eq('active', true).order('name'),
  ]);
  if (!job) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${job.job_number}`} description="Update job details. Changes won't reset the price guard.">
        <Button asChild variant="outline" size="sm"><Link href={`/orders/${job.id}`}><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
      </PageHeader>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Job</CardTitle></CardHeader>
        <CardContent>
          <form action={update} className="space-y-4">
            <input type="hidden" name="id" value={job.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="quantity">Quantity</Label><Input id="quantity" name="quantity" type="number" min={1} required defaultValue={job.quantity} /></div>
              <div className="space-y-1.5"><Label htmlFor="unit_price">Unit price</Label><Input id="unit_price" name="unit_price" type="number" step="0.01" min={0} required defaultValue={job.unit_price} /></div>
              <div className="space-y-1.5"><Label htmlFor="paper_qty">Paper qty (sheets)</Label><Input id="paper_qty" name="paper_qty" type="number" min={0} defaultValue={job.paper_qty} /></div>
              <div className="space-y-1.5"><Label htmlFor="paper_stock_id">Paper</Label>
                <select id="paper_stock_id" name="paper_stock_id" className={selectCls} defaultValue={job.paper_stock_id ?? ''}>
                  <option value="">— none —</option>
                  {(papers ?? []).map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="due_date">Due date</Label><Input id="due_date" name="due_date" type="date" defaultValue={job.due_date ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="priority">Priority</Label>
                <select id="priority" name="priority" className={selectCls} defaultValue={job.priority}>
                  <option value="low">low</option><option value="normal">normal</option><option value="high">high</option><option value="urgent">urgent</option>
                </select>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="is_rush" defaultChecked={job.is_rush} /> Rush job
            </label>
            <div className="space-y-1.5"><Label htmlFor="notes">Customer notes</Label><Textarea id="notes" name="notes" rows={2} defaultValue={job.notes ?? ''} /></div>
            <div className="space-y-1.5"><Label htmlFor="internal_notes">Internal notes</Label><Textarea id="internal_notes" name="internal_notes" rows={2} defaultValue={job.internal_notes ?? ''} /></div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
