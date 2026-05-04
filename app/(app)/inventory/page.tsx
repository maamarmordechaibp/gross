import { Plus, Boxes } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/app/empty-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import type { PaperStock } from '@/types/database';

export default async function InventoryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: stocks } = await supabase.from('paper_stocks').select('*').order('name').returns<PaperStock[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Paper stocks and reorder thresholds">
        <Button asChild><Link href="/inventory/new"><Plus className="h-4 w-4" />Receive stock</Link></Button>
      </PageHeader>

      {!stocks?.length ? (
        <EmptyState icon={Boxes} title="No paper stocks" description="Add your first paper to enable order creation." action={{ label: 'Add stock', href: '/inventory/new' }} />
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
              {stocks.map((s) => {
                const avail = s.qty_on_hand - s.qty_reserved;
                const low = avail <= s.reorder_threshold;
                return (
                  <tr key={s.id} className="hover:bg-accent/40">
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
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
