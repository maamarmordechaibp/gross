import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { JobStatusBadge } from '@/components/app/status-badge';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Customer, JobFull, Invoice } from '@/types/database';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: customer }, { data: jobs }, { data: invoices }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).maybeSingle<Customer>(),
    supabase.from('v_job_full').select('*').eq('customer_id', id).order('created_at', { ascending: false }).returns<JobFull[]>(),
    supabase.from('invoices').select('*').eq('customer_id', id).order('created_at', { ascending: false }).returns<Invoice[]>(),
  ]);
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={customer.name} description={customer.company ?? customer.email ?? undefined}>
        <Button asChild variant="outline" size="sm"><Link href="/customers"><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
        <Button asChild><Link href={`/orders/new?customer=${customer.id}`}><Plus className="h-4 w-4" />Create job</Link></Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">Email</div><div className="text-sm font-medium">{customer.email ?? '—'}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">Phone</div><div className="text-sm font-medium">{customer.phone ?? '—'}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">Customer since</div><div className="text-sm font-medium">{formatDate(customer.created_at)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders ({jobs?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({invoices?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardHeader><CardTitle>Order history</CardTitle></CardHeader>
            <CardContent>
              {!jobs?.length ? <p className="py-6 text-center text-sm text-muted-foreground">No orders yet</p> : (
                <ul className="divide-y -my-2">
                  {jobs.map((j) => (
                    <li key={j.id}>
                      <Link href={`/orders/${j.id}`} className="flex items-center gap-3 py-3 hover:bg-accent/40 -mx-2 px-2 rounded-md">
                        <span className="font-mono text-xs text-muted-foreground">{j.job_number}</span>
                        <span className="flex-1 truncate font-medium">{j.product_name}</span>
                        <span className="tabular text-sm">{formatCurrency(j.revenue ?? 0)}</span>
                        <JobStatusBadge status={j.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
            <CardContent>
              {!invoices?.length ? <p className="py-6 text-center text-sm text-muted-foreground">No invoices yet</p> : (
                <ul className="divide-y -my-2">
                  {invoices.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-3">
                      <span className="font-mono text-xs text-muted-foreground">{i.invoice_number}</span>
                      <span className="flex-1 capitalize">{i.status}</span>
                      <span className="tabular">{formatCurrency(i.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card><CardContent className="py-6"><p className="whitespace-pre-line text-sm">{customer.notes || 'No notes.'}</p></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
