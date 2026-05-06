import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/permissions';
import { toCsv, csvResponse } from '@/lib/csv';

export async function GET(req: Request) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const archived = url.searchParams.get('archived') === '1';

  let query = supabase.from('customers').select('id, name, company, email, phone, address, created_at');
  query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (q) {
    const esc = q.replace(/[%,]/g, '');
    query = query.or(`name.ilike.%${esc}%,company.ilike.%${esc}%,email.ilike.%${esc}%`);
  }
  const { data } = await query.order('created_at', { ascending: false });
  return csvResponse('customers.csv', toCsv(data ?? [], ['id','name','company','email','phone','address','created_at']));
}
