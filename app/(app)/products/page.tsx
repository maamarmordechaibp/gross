import { Plus, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/app/empty-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/types/database';

export default async function ProductsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('products').select('*').order('name').returns<Product[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="Products" description="Catalog and dynamic specs">
        <Button asChild><Link href="/products/new"><Plus className="h-4 w-4" />New Product</Link></Button>
      </PageHeader>
      {!data?.length ? (
        <EmptyState icon={ShoppingBag} title="No products yet" description="Define products that customers can order." action={{ label: 'Add product', href: '/products/new' }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{p.name}</h3>
                    <span className="text-xs text-muted-foreground">{p.category}</span>
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
