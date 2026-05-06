import { Plus, Scissors } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/app/empty-state';
import { SearchBar, FilterSelect } from '@/components/app/list-toolbar';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import type { FinishingOption } from '@/types/database';

export default async function FinishingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const archived = sp.archived === '1';
  const supabase = await createSupabaseServerClient();
  let query = supabase.from('finishing_options').select('*');
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (q) {
    const esc = q.replace(/[%,]/g, '');
    query = query.or(`name.ilike.%${esc}%,type.ilike.%${esc}%,machine.ilike.%${esc}%`);
  }
  const { data } = await query.order('type').returns<FinishingOption[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="Finishings" description="Cutting, folding, binding, lamination & more">
        <Button asChild><Link href="/finishings/new"><Plus className="h-4 w-4" />New Finishing</Link></Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar placeholder="Search finishings…" />
        <FilterSelect paramName="archived" label="Status" options={[{ value: '1', label: 'Archived' }]} />
      </div>
      {!data?.length ? (
        <EmptyState icon={Scissors} title={q ? 'No matches' : 'No finishings yet'} description={q ? 'Try a different search.' : 'Configure finishing options to attach to jobs.'} action={q ? undefined : { label: 'Add finishing', href: '/finishings/new' }} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Machine</th>
                <th className="px-4 py-2.5 text-right">Cost / unit</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((f) => (
                <tr key={f.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/finishings/${f.id}`} className="text-primary hover:underline">{f.name}</Link>
                  </td>
                  <td className="px-4 py-2.5 capitalize text-muted-foreground">{f.type}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{f.machine ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular">{formatCurrency(f.cost_per_unit)}</td>
                  <td className="px-4 py-2.5">{f.active === false ? <Badge variant="warning">Inactive</Badge> : <Badge variant="success">Active</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
