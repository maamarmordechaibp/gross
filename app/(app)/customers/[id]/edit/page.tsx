import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateCustomerAction } from '../../actions';
import type { Customer } from '@/types/database';

async function update(formData: FormData) {
  'use server';
  await updateCustomerAction(formData);
}

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: c } = await supabase.from('customers').select('*').eq('id', id).maybeSingle<Customer>();
  if (!c) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${c.name}`}>
        <Button asChild variant="outline" size="sm"><Link href={`/customers/${c.id}`}><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
      </PageHeader>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Customer details</CardTitle></CardHeader>
        <CardContent>
          <form action={update} className="space-y-4">
            <input type="hidden" name="id" value={c.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="name">Name *</Label><Input id="name" name="name" required defaultValue={c.name} /></div>
              <div className="space-y-1.5"><Label htmlFor="company">Company</Label><Input id="company" name="company" defaultValue={c.company ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={c.email ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" defaultValue={c.phone ?? ''} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={3} defaultValue={c.notes ?? ''} /></div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
