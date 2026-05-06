import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArchiveButton } from '@/components/app/archive-button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateFinishingAction, archiveFinishingAction } from '../actions';
import type { FinishingOption } from '@/types/database';

async function update(formData: FormData) {
  'use server';
  await updateFinishingAction(formData);
}

const TYPES = ['cutting','folding','laminating','binding','scoring','perforating','embossing','foiling','other'];
const selectCls = 'flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default async function FinishingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: f } = await supabase.from('finishing_options').select('*').eq('id', id).maybeSingle<FinishingOption>();
  if (!f) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={f.name} description={`Type: ${f.type}`}>
        <Button asChild variant="outline" size="sm"><Link href="/finishings"><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
        <ArchiveButton action={archiveFinishingAction} hiddenFields={{ id: f.id }} redirectTo="/finishings" />
      </PageHeader>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Finishing details</CardTitle></CardHeader>
        <CardContent>
          <form action={update} className="space-y-4">
            <input type="hidden" name="id" value={f.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required defaultValue={f.name} /></div>
              <div className="space-y-1.5"><Label htmlFor="type">Type *</Label>
                <select id="type" name="type" required className={selectCls} defaultValue={f.type}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select></div>
              <div className="space-y-1.5"><Label htmlFor="cost_per_unit">Cost per unit (USD)</Label>
                <Input id="cost_per_unit" name="cost_per_unit" type="number" step="0.0001" min={0} defaultValue={f.cost_per_unit} /></div>
              <div className="space-y-1.5"><Label htmlFor="machine">Machine</Label>
                <Input id="machine" name="machine" defaultValue={f.machine ?? ''} /></div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={f.active !== false} /> Active
            </label>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
