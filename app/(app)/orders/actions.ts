'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { jobSchema } from '@/lib/validators';
import { sendEmail } from '@/lib/resend';
import { orderReadyEmail, orderDeliveredEmail, invoiceCreatedEmail } from '@/lib/email-templates';
import { calculatePrice } from '@/lib/pricing/calculate';

export async function createJobAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const raw = JSON.parse(String(formData.get('payload')));
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { finishings, ...job } = parsed.data;
  const specColor = (job.specs?.color as 'color' | 'bw' | undefined) ?? 'color';
  const specSides = (job.specs?.sides as 1 | 2 | undefined) === 2 ? 2 : 1;

  // Server-side guard: never allow a job priced below cost.
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

  const { data: created, error } = await supabase
    .from('jobs')
    .insert({ ...job, created_by: user.id })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  if (finishings.length) {
    const rows = finishings.map((f) => ({ job_id: created!.id, ...f }));
    const { error: fErr } = await supabase.from('job_finishings').insert(rows);
    if (fErr) return { ok: false, error: fErr.message };
  }

  revalidatePath('/orders');
  revalidatePath('/dashboard');
  redirect(`/orders/${created!.id}`);
}

export async function updateJobStatusAction(jobId: string, status: string) {
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'completed') patch.printed_at = new Date().toISOString();

  const { data: job, error } = await supabase
    .from('jobs')
    .update(patch)
    .eq('id', jobId)
    .select('id, job_number, status, customer_id, quantity, unit_price, due_date, notes, customers(name, email), products(name)')
    .single<{
      id: string; job_number: string; status: string; customer_id: string;
      quantity: number; unit_price: number; due_date: string | null; notes: string | null;
      customers: { name: string; email: string | null } | null;
      products: { name: string } | null;
    }>();
  if (error) return { ok: false, error: error.message };

  // Resolve reply-to once for any customer-facing email below.
  const { data: settings } = await supabase
    .from('settings')
    .select('company_email, tax_rate')
    .eq('id', 1)
    .single<{ company_email: string | null; tax_rate: number }>();
  const replyTo = settings?.company_email ?? undefined;

  // On completion: auto-create a draft invoice if none exists for this job.
  if (status === 'completed' && job) {
    const { data: existing } = await supabase
      .from('invoices')
      .select('id')
      .eq('job_id', job.id)
      .maybeSingle();
    if (!existing) {
      const subtotal = (job.quantity || 0) * (job.unit_price || 0);
      const taxRate = Number(settings?.tax_rate ?? 0);
      const tax = +(subtotal * taxRate).toFixed(2);
      const total = +(subtotal + tax).toFixed(2);
      const due = new Date();
      due.setDate(due.getDate() + 30);
      const { data: inv } = await supabase
        .from('invoices')
        .insert({
          customer_id: job.customer_id,
          job_id: job.id,
          subtotal, tax, total,
          due_date: due.toISOString().slice(0, 10),
          status: 'draft',
        })
        .select('id, invoice_number, total, due_date')
        .single<{ id: string; invoice_number: string; total: number; due_date: string | null }>();
      if (inv && job.customers?.email) {
        const tpl = invoiceCreatedEmail({
          invoice_number: inv.invoice_number,
          customer_name: job.customers.name,
          total: Number(inv.total),
          due_date: inv.due_date,
          job_number: job.job_number,
        });
        await sendEmail({ to: job.customers.email, reply_to: replyTo, ...tpl });
      }
      revalidatePath('/invoices');
    }
  }

  // Notify customer when job is ready (with invoice) or delivered
  if ((status === 'completed' || status === 'delivered') && job?.customers?.email) {
    const tpl = (status === 'completed' ? orderReadyEmail : orderDeliveredEmail)({
      job_number: job.job_number,
      product_name: job.products?.name ?? null,
      customer_name: job.customers.name ?? null,
      quantity: job.quantity,
      unit_price: job.unit_price,
      due_date: job.due_date,
      notes: job.notes,
    });
    await sendEmail({ to: job.customers.email, reply_to: replyTo, ...tpl });
  }

  revalidatePath('/production');
  revalidatePath('/orders');
  revalidatePath(`/orders/${jobId}`);
  return { ok: true };
}

export async function assignPrinterAction(jobId: string, printer: string | null) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('jobs')
    .update({ printer: printer || null })
    .eq('id', jobId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/production');
  revalidatePath(`/orders/${jobId}`);
  return { ok: true as const };
}

/**
 * Register a file uploaded to the `job-files` storage bucket
 * by inserting the public.files row that points at it.
 */
export async function registerJobFileAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not authenticated' };

  const job_id = String(formData.get('job_id') ?? '');
  const storage_path = String(formData.get('storage_path') ?? '');
  const name = String(formData.get('name') ?? '');
  const size = Number(formData.get('size') ?? 0) || null;
  const mime = (formData.get('mime') as string) || null;
  if (!job_id || !storage_path || !name) return { ok: false as const, error: 'Missing fields' };

  const { data, error } = await supabase.from('files').insert({
    owner_type: 'job',
    owner_id: job_id,
    storage_path,
    bucket: 'job-files',
    name, size, mime,
    uploaded_by: user.id,
  }).select('id, name, size, mime, storage_path, created_at').single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/orders/${job_id}`);
  return { ok: true as const, file: data! };
}

export async function deleteJobFileAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const file_id = String(formData.get('file_id') ?? '');
  const storage_path = String(formData.get('storage_path') ?? '');
  if (!file_id || !storage_path) return { ok: false as const, error: 'Missing fields' };

  await supabase.storage.from('job-files').remove([storage_path]);
  const { error } = await supabase.from('files').delete().eq('id', file_id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
