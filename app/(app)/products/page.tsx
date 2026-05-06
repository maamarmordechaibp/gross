import { Plus, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/app/empty-state';
import { SearchBar, FilterSelect } from '@/components/app/list-toolbar';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/types/database';

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const archived = sp.archived === '1';
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('products').select('*');
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (q) {
    const esc = q.replace(/[%,]/g, '');
    query = query.or(`name.ilike.%${esc}%,category.ilike.%${esc}%,description.ilike.%${esc}%`);
  }
  const { data } = await query.order('name').returns<Product[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="Products" description="Catalog and dynamic specs">
        <Button asChild><Link href="/products/new"><Plus className="h-4 w-4" />New Product</Link></Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar placeholder="Search products…" />
        <FilterSelect paramName="archived" label="View" options={[{ value: '1', label: 'Archived' }]} />
      </div>
      {!data?.length ? (
        <EmptyState icon={ShoppingBag} title={q ? 'No matches' : 'No products yet'} description={q ? 'Try a different search.' : 'Define products that customers can order.'} action={q ? undefined : { label: 'Add product', href: '/products/new' }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.active === false && <Badge variant="warning">Inactive</Badge>}
                    {p.active !== false && <span className="text-xs text-muted-foreground">{p.category}</span>}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  <div className="text-sm font-medium tabular">{formatCurrency(p.base_price)} base</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
