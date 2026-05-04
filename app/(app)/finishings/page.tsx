import { Plus, Scissors } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/app/empty-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import type { FinishingOption } from '@/types/database';

export default async function FinishingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('finishing_options').select('*').order('type').returns<FinishingOption[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="Finishings" description="Cutting, folding, binding, lamination & more">
        <Button asChild><Link href="/finishings/new"><Plus className="h-4 w-4" />New Finishing</Link></Button>
      </PageHeader>
      {!data?.length ? (
        <EmptyState icon={Scissors} title="No finishings yet" description="Configure finishing options to attach to jobs." action={{ label: 'Add finishing', href: '/finishings/new' }} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Machine</th>
                <th className="px-4 py-2.5 text-right">Cost / unit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((f) => (
                <tr key={f.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-medium">{f.name}</td>
                  <td className="px-4 py-2.5 capitalize text-muted-foreground">{f.type}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{f.machine ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular">{formatCurrency(f.cost_per_unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
