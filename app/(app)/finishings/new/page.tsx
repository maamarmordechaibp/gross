import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createFinishingAction } from '../actions';

async function action(formData: FormData) {
  'use server';
  await createFinishingAction(formData);
}

const TYPES = ['cutting','folding','laminating','binding','scoring','perforating','embossing','foiling','other'];
const selectCls = 'flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function NewFinishingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New finishing option">
        <Button asChild variant="outline" size="sm"><Link href="/finishings"><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
      </PageHeader>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Finishing details</CardTitle></CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required placeholder="Cut to size" /></div>
              <div className="space-y-1.5"><Label htmlFor="type">Type *</Label>
                <select id="type" name="type" required className={selectCls} defaultValue="cutting">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select></div>
              <div className="space-y-1.5"><Label htmlFor="cost_per_unit">Cost per unit (USD)</Label>
                <Input id="cost_per_unit" name="cost_per_unit" type="number" step="0.0001" min={0} defaultValue={0} /></div>
              <div className="space-y-1.5"><Label htmlFor="machine">Machine</Label>
                <Input id="machine" name="machine" placeholder="Polar 92" /></div>
            </div>
            <Button type="submit">Create finishing</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
