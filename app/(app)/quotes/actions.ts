'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/resend';
import { quoteSentEmail } from '@/lib/email-templates';
import { jobSchema } from '@/lib/validators';
import { calculatePrice } from '@/lib/pricing/calculate';

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
    .select('id, quote_number, total, approval_token, valid_until, customers(name, email)')
    .eq('id', quoteId)
    .single<{
      id: string; quote_number: string; total: number; approval_token: string;
      valid_until: string | null;
      customers: { name: string; email: string | null };
    }>();
  if (error || !q) return { ok: false as const, error: error?.message ?? 'Quote not found' };

  const { data: settings } = await supabase.from('settings').select('company_email').eq('id', 1).single<{ company_email: string | null }>();
  const replyTo = settings?.company_email ?? undefined;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${baseUrl}/quote/approve/${q.approval_token}`;

  if (q.customers.email) {
    const tpl = quoteSentEmail({
      quote_number: q.quote_number,
      customer_name: q.customers.name,
      total: Number(q.total),
      valid_until: q.valid_until,
      approve_url: url,
    });
    await sendEmail({ to: q.customers.email, reply_to: replyTo, ...tpl });
  }

  await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', quoteId);
  revalidatePath('/quotes');
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true as const, url };
}

/**
 * Create a quote from the order-form payload (same shape as createJobAction).
 * Stores full job spec so it can be materialized into a job upon approval.
 */
export async function createQuoteFromOrderFormAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const raw = JSON.parse(String(formData.get('payload')));
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { finishings, ...job } = parsed.data;
  const specColor = (job.specs?.color as 'color' | 'bw' | undefined) ?? 'color';
  const specSides = (job.specs?.sides as 1 | 2 | undefined) === 2 ? 2 : 1;

  // Recompute totals server-side so customer sees authoritative numbers.
  const [paperRes, foRes, settingsRes] = await Promise.all([
    job.paper_stock_id
      ? supabase.from('paper_stocks')
          .select('cost_per_sheet, ink_bw_1side, ink_bw_2side, ink_color_1side, ink_color_2side')
          .eq('id', job.paper_stock_id).single<{
            cost_per_sheet: number;
            ink_bw_1side: number; ink_bw_2side: number;
            ink_color_1side: number; ink_color_2side: number;
          }>()
      : Promise.resolve({ data: null, error: null }),
    finishings.length
      ? supabase.from('finishing_options').select('id, cost_per_unit').in('id', finishings.map((f) => f.finishing_option_id))
      : Promise.resolve({ data: [] as { id: string; cost_per_unit: number }[], error: null }),
    supabase.from('settings').select('rush_multiplier, tax_rate').eq('id', 1).single<{ rush_multiplier: number; tax_rate: number }>(),
  ]);

  const inkPerPiece = paperRes.data
    ? (specColor === 'color'
        ? (specSides === 2 ? paperRes.data.ink_color_2side : paperRes.data.ink_color_1side)
        : (specSides === 2 ? paperRes.data.ink_bw_2side    : paperRes.data.ink_bw_1side))
    : 0;
  const foMap = new Map((foRes.data ?? []).map((f) => [f.id, f.cost_per_unit]));
  const breakdown = calculatePrice({
    paperCostPerSheet: paperRes.data?.cost_per_sheet ?? 0,
    paperQty: job.paper_qty ?? 0,
    inkCost: inkPerPiece * (job.quantity || 0),
    finishings: finishings.map((f) => ({ cost_per_unit: foMap.get(f.finishing_option_id) ?? 0, qty: f.qty })),
    unitPrice: job.unit_price,
    quantity: job.quantity,
    isRush: job.is_rush ?? false,
    rushMultiplier: Number(settingsRes.data?.rush_multiplier ?? 0.25),
    taxRate: Number(settingsRes.data?.tax_rate ?? 0),
  });
  if (breakdown.totalCost > 0 && breakdown.revenue < breakdown.totalCost) {
    return { ok: false, error: `Price is below cost (loss of $${(breakdown.totalCost - breakdown.revenue).toFixed(2)}). Raise the unit price.` };
  }

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      customer_id: job.customer_id,
      subtotal: breakdown.revenue,
      tax: breakdown.tax,
      total: breakdown.grandTotal,
      spec: { ...parsed.data },
      valid_until: validUntil.toISOString(),
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath('/quotes');
  redirect(`/quotes/${data!.id}`);
}
