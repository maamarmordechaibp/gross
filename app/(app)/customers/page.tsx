import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/app/empty-state';
import { SearchBar, FilterSelect, Pagination, ExportCsvButton } from '@/components/app/list-toolbar';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';
import type { Customer } from '@/types/database';

const PER_PAGE = 25;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const archived = sp.archived === '1';
  const page = Math.max(1, Number(sp.page ?? 1));
  const supabase = await createSupabaseServerClient();

  let query = supabase.from('customers').select('*', { count: 'exact' });
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (q) {
    const esc = q.replace(/[%,]/g, '');
    query = query.or(`name.ilike.%${esc}%,company.ilike.%${esc}%,email.ilike.%${esc}%`);
  }
  query = query.order('created_at', { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  const { data, count } = await query.returns<Customer[]>();
  const total = count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="People and companies you print for">
        <ExportCsvButton href="/api/exports/customers" />
        <Button asChild><Link href="/customers/new"><Plus className="h-4 w-4" />New Customer</Link></Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar placeholder="Search name, company, email…" />
        <FilterSelect paramName="archived" label="View" options={[{ value: '1', label: 'Archived' }]} />
      </div>

      {!data || data.length === 0 ? (
        <EmptyState icon={Users} title={q ? 'No matches' : 'No customers yet'} description={q ? 'Try a different search.' : 'Add your first customer to start creating orders.'} action={q ? undefined : { label: 'Add customer', href: '/customers/new' }} />
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
          <Pagination page={page} perPage={PER_PAGE} total={total} />
        </Card>
      )}
    </div>
  );
}
