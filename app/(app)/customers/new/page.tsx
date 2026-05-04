import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createCustomerAction } from '../actions';

async function action(formData: FormData) {
  'use server';
  await createCustomerAction(formData);
}

export default function NewCustomerPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New Customer">
        <Button asChild variant="outline" size="sm"><Link href="/customers"><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
      </PageHeader>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Customer details</CardTitle></CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="name">Name *</Label><Input id="name" name="name" required /></div>
              <div className="space-y-1.5"><Label htmlFor="company">Company</Label><Input id="company" name="company" /></div>
              <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div>
              <div className="space-y-1.5"><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={3} /></div>
            <Button type="submit">Create customer</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
