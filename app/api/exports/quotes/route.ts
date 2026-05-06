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

  let query = supabase.from('quotes').select('quote_number, customers(name), subtotal, tax, total, status, sent_at, valid_until, created_at');
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (status) query = query.eq('status', status);
  if (q) query = query.ilike('quote_number', `%${q.replace(/[%,]/g, '')}%`);
  const { data } = await query.order('created_at', { ascending: false });
  const flat = ((data ?? []) as unknown as Array<{ quote_number: string; customers: { name: string } | null; subtotal: number; tax: number; total: number; status: string; sent_at: string | null; valid_until: string | null; created_at: string }>).map((qq) => ({
    quote_number: qq.quote_number,
    customer: qq.customers?.name ?? '',
    subtotal: qq.subtotal, tax: qq.tax, total: qq.total,
    status: qq.status, sent_at: qq.sent_at, valid_until: qq.valid_until, created_at: qq.created_at,
  }));
  return csvResponse('quotes.csv', toCsv(flat));
}
