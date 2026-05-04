'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const invoiceCreateSchema = z.object({
  customer_id: z.string().uuid(),
  job_id: z.string().uuid().nullable().optional(),
  subtotal: z.coerce.number().nonnegative(),
  tax: z.coerce.number().nonnegative().default(0),
  total: z.coerce.number().nonnegative(),
  notes: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

export async function createInvoiceAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not authenticated' };

  const parsed = invoiceCreateSchema.safeParse({
    customer_id: formData.get('customer_id'),
    job_id: formData.get('job_id') || null,
    subtotal: formData.get('subtotal') || 0,
    tax: formData.get('tax') || 0,
    total: formData.get('total') || 0,
    notes: formData.get('notes') || null,
    due_date: formData.get('due_date') || null,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from('invoices')
    .insert({ ...parsed.data, created_by: user.id })
    .select('id')
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/invoices');
  redirect(`/invoices/${data!.id}`);
}

export async function recordPaymentAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not authenticated' };

  const invoiceId = String(formData.get('invoice_id') ?? '');
  const amount = Number(formData.get('amount') ?? 0);
  const method = String(formData.get('method') ?? 'manual');
  if (!invoiceId || amount <= 0) return { ok: false as const, error: 'Provide an invoice and amount > 0' };

  const { error } = await supabase.from('payments').insert({
    invoice_id: invoiceId, amount, method, recorded_by: user.id,
    notes: (formData.get('notes') as string) || null,
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath('/invoices');
  return { ok: true as const };
}
