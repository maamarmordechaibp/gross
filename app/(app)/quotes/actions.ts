'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/resend';

const quoteCreateSchema = z.object({
  customer_id: z.string().uuid(),
  job_id: z.string().uuid().nullable().optional(),
  subtotal: z.coerce.number().nonnegative(),
  tax: z.coerce.number().nonnegative().default(0),
  total: z.coerce.number().nonnegative(),
  notes: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
});

export async function createQuoteAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not authenticated' };

  const parsed = quoteCreateSchema.safeParse({
    customer_id: formData.get('customer_id'),
    job_id: formData.get('job_id') || null,
    subtotal: formData.get('subtotal') || 0,
    tax: formData.get('tax') || 0,
    total: formData.get('total') || 0,
    notes: formData.get('notes') || null,
    valid_until: formData.get('valid_until') || null,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from('quotes')
    .insert({ ...parsed.data, created_by: user.id })
    .select('id')
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/quotes');
  redirect(`/quotes/${data!.id}`);
}

/**
 * Mark a quote as sent and email a public approval link to the customer.
 * If RESEND_API_KEY is unset, just records sent_at without sending.
 */
export async function sendQuoteAction(quoteId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: q, error } = await supabase
    .from('quotes')
    .select('id, quote_number, total, approval_token, customers(name, email)')
    .eq('id', quoteId)
    .single<{
      id: string; quote_number: string; total: number; approval_token: string;
      customers: { name: string; email: string | null };
    }>();
  if (error || !q) return { ok: false as const, error: error?.message ?? 'Quote not found' };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${baseUrl}/quote/approve?token=${q.approval_token}`;

  if (q.customers.email) {
    await sendEmail({
      to: q.customers.email,
      subject: `Quote ${q.quote_number} from Gross Printing`,
      html: `<p>Hi ${q.customers.name},</p>
             <p>Your quote <strong>${q.quote_number}</strong> for <strong>$${Number(q.total).toFixed(2)}</strong> is ready.</p>
             <p><a href="${url}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Review &amp; approve</a></p>`,
    });
  }

  await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', quoteId);
  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true as const, url };
}
