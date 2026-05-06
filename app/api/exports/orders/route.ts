import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/permissions';
import { toCsv, csvResponse } from '@/lib/csv';

export async function GET(req: Request) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const status = url.searchParams.get('status') ?? '';
  const rush = url.searchParams.get('rush') ?? '';

  let query = supabase.from('v_job_full').select('job_number, customer_name, product_name, quantity, unit_price, revenue, status, is_rush, due_date, created_at');
  if (status) query = query.eq('status', status);
  if (rush === '1') query = query.eq('is_rush', true);
  if (q) {
    const esc = q.replace(/[%,]/g, '');
    query = query.or(`job_number.ilike.%${esc}%,customer_name.ilike.%${esc}%,product_name.ilike.%${esc}%`);
  }
  const { data } = await query.order('created_at', { ascending: false });
  return csvResponse('orders.csv', toCsv(data ?? []));
}
