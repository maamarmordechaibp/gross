import { Plus, Boxes } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/app/empty-state';
import { SearchBar, FilterSelect } from '@/components/app/list-toolbar';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import type { PaperStock } from '@/types/database';

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const view = sp.view ?? '';
  const archived = sp.archived === '1';
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('paper_stocks').select('*');
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (q) {
    const esc = q.replace(/[%,]/g, '');
    query = query.or(`name.ilike.%${esc}%,size.ilike.%${esc}%,color.ilike.%${esc}%,finish.ilike.%${esc}%`);
  }
  const { data: stocks } = await query.order('name').returns<PaperStock[]>();
  const filtered = view === 'low'
    ? (stocks ?? []).filter((s) => (s.qty_on_hand - s.qty_reserved) <= s.reorder_threshold)
    : stocks ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Paper stocks and reorder thresholds">
        <Button asChild><Link href="/inventory/new"><Plus className="h-4 w-4" />Receive stock</Link></Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar placeholder="Search paper…" />
        <FilterSelect paramName="view" label="View" options={[{ value: 'low', label: 'Low stock' }]} />
        <FilterSelect paramName="archived" label="Status" options={[{ value: '1', label: 'Archived' }]} />
      </div>
      {!filtered.length ? (
        <EmptyState icon={Boxes} title={q || view ? 'No matches' : 'No paper stocks'} description={q || view ? 'Try clearing filters.' : 'Add your first paper to enable order creation.'} action={q || view ? undefined : { label: 'Add stock', href: '/inventory/new' }} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Size</th>
                <th className="px-4 py-2.5 text-right">On hand</th>
                <th className="px-4 py-2.5 text-right">Reserved</th>
                <th className="px-4 py-2.5 text-right">Available</th>
                <th className="px-4 py-2.5 text-right">Cost / sheet</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((s) => {
                const avail = s.qty_on_hand - s.qty_reserved;
                const low = avail <= s.reorder_threshold;
                return (
                  <tr key={s.id} className="hover:bg-accent/40">
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/inventory/${s.id}`} className="text-primary hover:underline">{s.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.size}</td>
                    <td className="px-4 py-2.5 text-right tabular">{s.qty_on_hand.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular text-muted-foreground">{s.qty_reserved.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular font-medium">{avail.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular">{formatCurrency(s.cost_per_sheet)}</td>
                    <td className="px-4 py-2.5"><Badge variant={low ? 'warning' : 'success'}>{low ? 'Low' : 'OK'}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
