import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/app/empty-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import type { Customer } from '@/types/database';

export default async function CustomersPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false }).returns<Customer[]>();

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="People and companies you print for">
        <Button asChild><Link href="/customers/new"><Plus className="h-4 w-4" />New Customer</Link></Button>
      </PageHeader>

      {!data || data.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" description="Add your first customer to start creating orders." action={{ label: 'Add customer', href: '/customers/new' }} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2.5"><Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.company ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.phone ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
