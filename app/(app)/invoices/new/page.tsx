import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Customer } from '@/types/database';
import { InvoiceForm } from './invoice-form';

export default async function NewInvoicePage() {
  const supabase = await createSupabaseServerClient();
  const { data: customers } = await supabase
    .from('customers').select('id, name, company').order('name')
    .returns<Pick<Customer, 'id' | 'name' | 'company'>[]>();
  const { data: settings } = await supabase
    .from('settings').select('tax_rate').eq('id', 1).single();

  return (
    <div className="space-y-6">
      <PageHeader title="New invoice">
        <Button asChild variant="outline" size="sm"><Link href="/invoices"><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
      </PageHeader>
      <Card className="max-w-3xl">
        <CardHeader><CardTitle>Invoice details</CardTitle></CardHeader>
        <CardContent>
          <InvoiceForm customers={customers ?? []} taxRate={Number(settings?.tax_rate ?? 0)} />
        </CardContent>
      </Card>
    </div>
  );
}
