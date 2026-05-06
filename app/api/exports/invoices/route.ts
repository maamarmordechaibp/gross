import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/permissions';
import { toCsv, csvResponse } from '@/lib/csv';

export async function GET(req: Request) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const status = url.searchParams.get('status') ?? '';
  const archived = url.searchParams.get('archived') === '1';

  let query = supabase.from('invoices').select('invoice_number, customers(name), subtotal, tax, total, amount_paid, status, due_date, created_at');
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (status) query = query.eq('status', status);
  if (q) query = query.ilike('invoice_number', `%${q.replace(/[%,]/g, '')}%`);
  const { data } = await query.order('created_at', { ascending: false });
  const flat = ((data ?? []) as unknown as Array<{ invoice_number: string; customers: { name: string } | null; subtotal: number; tax: number; total: number; amount_paid: number; status: string; due_date: string | null; created_at: string }>).map((i) => ({
    invoice_number: i.invoice_number,
    customer: i.customers?.name ?? '',
    subtotal: i.subtotal, tax: i.tax, total: i.total,
    amount_paid: i.amount_paid, balance: Number(i.total) - Number(i.amount_paid),
    status: i.status, due_date: i.due_date, created_at: i.created_at,
  }));
  return csvResponse('invoices.csv', toCsv(flat));
}
