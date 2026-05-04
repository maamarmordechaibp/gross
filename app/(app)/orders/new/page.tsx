import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Customer, Product, PaperStock, FinishingOption } from '@/types/database';
import { OrderForm } from './order-form';

export default async function NewOrderPage() {
  const supabase = await createSupabaseServerClient();
  const [customersRes, productsRes, papersRes, finishingsRes, settingsRes] = await Promise.all([
    supabase.rpc('app_picklist_a'),
    supabase.from('products').select('*').eq('active', true).order('name').returns<Product[]>(),
    supabase.from('paper_stocks').select('*').eq('active', true).order('name').returns<PaperStock[]>(),
    supabase.from('finishing_options').select('*').eq('active', true).order('name').returns<FinishingOption[]>(),
    supabase.from('settings').select('tax_rate, rush_multiplier').eq('id', 1).single(),
  ]);

  if (customersRes.error) console.error('[orders/new] customers error:', customersRes.error);

  return (
    <div className="space-y-6">
      <PageHeader title="New Order" description="Create a print job">
        <Button asChild variant="outline" size="sm">
          <Link href="/orders"><ArrowLeft className="h-3.5 w-3.5" />Back</Link>
        </Button>
      </PageHeader>

      <OrderForm
        customers={(customersRes.data ?? []) as Customer[]}
        products={productsRes.data ?? []}
        papers={papersRes.data ?? []}
        finishings={finishingsRes.data ?? []}
        taxRate={Number(settingsRes.data?.tax_rate ?? 0)}
        rushMultiplier={Number(settingsRes.data?.rush_multiplier ?? 0.25)}
      />
    </div>
  );
}
