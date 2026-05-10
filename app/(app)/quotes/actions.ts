'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/resend';
import { quoteSentEmail } from '@/lib/email-templates';
import { jobSchema } from '@/lib/validators';
import { calculatePrice } from '@/lib/pricing/calculate';
import { requireRole } from '@/lib/permissions';

const lineItemSchema = z.object({
  description: z.string().min(1),
  qty: z.coerce.number().nonnegative(),
  unit_price: z.coerce.number().nonnegative(),
  total: z.coerce.number().nonnegative(),
});

const quoteCreateSchema = z.object({
  customer_id: z.string().uuid(),
  job_id: z.string().uuid().nullable().optional(),
  subtotal: z.coerce.number().nonnegative(),
  tax: z.coerce.number().nonnegative().default(0),
  total: z.coerce.number().nonnegative(),
  notes: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  line_items: z.array(lineItemSchema).default([]),
});

function parseQuoteForm(formData: FormData) {
  let lineItems: unknown = [];
  try { lineItems = JSON.parse(String(formData.get('line_items') ?? '[]')); } catch { /* ignore */ }
  return quoteCreateSchema.safeParse({
    customer_id: formData.get('customer_id'),
    job_id: formData.get('job_id') || null,
    subtotal: formData.get('subtotal') || 0,
    tax: formData.get('tax') || 0,
    total: formData.get('total') || 0,
    notes: formData.get('notes') || null,
    valid_until: formData.get('valid_until') || null,
    line_items: lineItems,
  });
}

export async function createQuoteAction(formData: FormData) {
  const { user } = await requireRole('staff');
  const supabase = await createSupabaseServerClient();

  const parsed = parseQuoteForm(formData);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from('quotes')
    .insert({ ...parsed.data, created_by: user.id })
    .select('id')
    .single();
  if (error) return { ok: false as const, error: error.message };

  // Auto-send to the customer (no-op if customer has no email or RESEND_API_KEY is unset).
  await sendQuoteAction(data!.id).catch((e) => console.error('[quotes.create] auto-send failed:', e));

  revalidatePath('/quotes');
  redirect(`/quotes/${data!.id}`);
}

export async function updateQuoteAction(formData: FormData) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false as const, error: 'Missing id' };

  // Quote should only be edited while still draft.
  const { data: existing } = await supabase.from('quotes').select('status').eq('id', id).single<{ status: string }>();
  if (existing && existing.status !== 'draft') {
    return { ok: false as const, error: `Cannot edit a ${existing.status} quote` };
  }

  const parsed = parseQuoteForm(formData);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  const { error } = await supabase.from('quotes').update(parsed.data).eq('id', id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${id}`);
  redirect(`/quotes/${id}`);
}

export async function archiveQuoteAction(formData: FormData) {
  await requireRole('manager');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false as const, error: 'Missing id' };
  const { error } = await supabase.from('quotes').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/quotes');
  return { ok: true as const };
}

/**
 * Mark a quote as sent and email a public approval link to the customer.
 * If RESEND_API_KEY is unset, just records sent_at without sending.
 */
export async function sendQuoteAction(quoteId: string) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const { data: q, error } = await supabase
    .from('quotes')
    .select('id, quote_number, total, approval_token, valid_until, line_items, customers(name, email)')
    .eq('id', quoteId)
    .single<{
      id: string; quote_number: string; total: number; approval_token: string;
      valid_until: string | null; line_items: Array<{ description: string; qty: number; unit_price: number; total: number }> | null;
      customers: { name: string; email: string | null };
    }>();
  if (error || !q) return { ok: false as const, error: error?.message ?? 'Quote not found' };

  const { data: settings } = await supabase.from('settings').select('company_email').eq('id', 1).single<{ company_email: string | null }>();
  const replyTo = settings?.company_email ?? undefined;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.grossprinting.shop';
  const url = `${baseUrl}/quote/approve/${q.approval_token}`;

  if (q.customers.email) {
    const tpl = quoteSentEmail({
      quote_number: q.quote_number,
      customer_name: q.customers.name,
      total: Number(q.total),
      valid_until: q.valid_until,
      approve_url: url,
    });
    const result = await sendEmail({ to: q.customers.email, reply_to: replyTo, ...tpl });
    if (result && 'error' in result && result.error) {
      // Don't fail the whole action — record send anyway and surface a soft error.
      console.error('[quotes.send] email failed:', result.error);
    }
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
  const { user } = await requireRole('staff');
  const supabase = await createSupabaseServerClient();

  const raw = JSON.parse(String(formData.get('payload')));
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { finishings, ...job } = parsed.data;
  const specColor = (job.specs?.color as 'color' | 'bw' | undefined) ?? 'color';
  const specSides = (job.specs?.sides as 1 | 2 | undefined) === 2 ? 2 : 1;

  const [paperRes, foRes, settingsRes, productRes] = await Promise.all([
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
      ? supabase.from('finishing_options').select('id, name, cost_per_unit').in('id', finishings.map((f) => f.finishing_option_id))
      : Promise.resolve({ data: [] as { id: string; name: string; cost_per_unit: number }[], error: null }),
    supabase.from('settings').select('rush_multiplier, tax_rate').eq('id', 1).single<{ rush_multiplier: number; tax_rate: number }>(),
    supabase.from('products').select('name').eq('id', job.product_id).single<{ name: string }>(),
  ]);

  const inkPerPiece = paperRes.data
    ? (specColor === 'color'
        ? (specSides === 2 ? paperRes.data.ink_color_2side : paperRes.data.ink_color_1side)
        : (specSides === 2 ? paperRes.data.ink_bw_2side    : paperRes.data.ink_bw_1side))
    : 0;
  const foMap = new Map((foRes.data ?? []).map((f) => [f.id, { name: f.name, cost_per_unit: f.cost_per_unit }]));
  const breakdown = calculatePrice({
    paperCostPerSheet: paperRes.data?.cost_per_sheet ?? 0,
    paperQty: job.paper_qty ?? 0,
    inkCost: inkPerPiece * (job.quantity || 0),
    finishings: finishings.map((f) => ({ cost_per_unit: foMap.get(f.finishing_option_id)?.cost_per_unit ?? 0, qty: f.qty })),
    unitPrice: job.unit_price,
    quantity: job.quantity,
    isRush: job.is_rush ?? false,
    rushMultiplier: Number(settingsRes.data?.rush_multiplier ?? 0.25),
    taxRate: Number(settingsRes.data?.tax_rate ?? 0),
  });
  if (breakdown.totalCost > 0 && breakdown.revenue < breakdown.totalCost) {
    return { ok: false, error: `Price is below cost (loss of $${(breakdown.totalCost - breakdown.revenue).toFixed(2)}). Raise the unit price.` };
  }

  // Derive line items (visible in customer email + detail).
  const lineItems = [
    {
      description: `${productRes.data?.name ?? 'Print job'}${job.is_rush ? ' (rush)' : ''}`,
      qty: job.quantity,
      unit_price: job.unit_price,
      total: +(job.unit_price * job.quantity).toFixed(2),
    },
    ...finishings.map((f) => {
      const meta = foMap.get(f.finishing_option_id);
      return {
        description: `Finishing — ${meta?.name ?? 'option'}`,
        qty: f.qty,
        unit_price: meta?.cost_per_unit ?? 0,
        total: +((meta?.cost_per_unit ?? 0) * f.qty).toFixed(2),
      };
    }),
    ...(breakdown.rushSurcharge > 0
      ? [{ description: 'Rush surcharge', qty: 1, unit_price: breakdown.rushSurcharge, total: breakdown.rushSurcharge }]
      : []),
  ];

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
      line_items: lineItems,
      valid_until: validUntil.toISOString(),
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  // Auto-send to the customer (no-op if no email / RESEND_API_KEY).
  await sendQuoteAction(data!.id).catch((e) => console.error('[quotes.create-from-order] auto-send failed:', e));

  revalidatePath('/quotes');
  redirect(`/quotes/${data!.id}`);
}

/**
 * Staff records customer's verbal approval (or decline) over the phone.
 * Mirrors the public token-based action but is gated by the staff role and
 * uses the authenticated server client so RLS still applies.
 */
export async function approveQuoteOnBehalfAction(quoteId: string) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();

  const { data: q, error } = await supabase
    .from('quotes')
    .select('id, status, customer_id, spec, job_id')
    .eq('id', quoteId)
    .single<{ id: string; status: string; customer_id: string; spec: unknown; job_id: string | null }>();
  if (error || !q) return { ok: false as const, error: error?.message ?? 'Quote not found' };

  if (q.status === 'approved' && q.job_id) {
    return { ok: true as const, jobId: q.job_id };
  }

  let jobId: string | null = q.job_id;

  if (!jobId && q.spec) {
    const parsed = jobSchema.safeParse(q.spec);
    if (parsed.success) {
      const { finishings, ...job } = parsed.data;
      const { data: created } = await supabase
        .from('jobs')
        .insert({ ...job, customer_id: q.customer_id })
        .select('id')
        .single<{ id: string }>();
      if (created) {
        jobId = created.id;
        if (finishings.length) {
          await supabase
            .from('job_finishings')
            .insert(finishings.map((f) => ({ job_id: created.id, ...f })));
        }
      }
    }
  }

  const { error: updErr } = await supabase
    .from('quotes')
    .update({
      status: 'approved',
      decided_at: new Date().toISOString(),
      job_id: jobId,
    })
    .eq('id', q.id);
  if (updErr) return { ok: false as const, error: updErr.message };

  revalidatePath(`/quotes/${q.id}`);
  revalidatePath('/quotes');
  revalidatePath('/orders');
  return { ok: true as const, jobId };
}

export async function rejectQuoteOnBehalfAction(quoteId: string) {
  await requireRole('staff');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('quotes')
    .update({ status: 'rejected', decided_at: new Date().toISOString() })
    .eq('id', quoteId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath('/quotes');
  return { ok: true as const };
}
