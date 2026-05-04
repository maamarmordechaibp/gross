'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { jobSchema } from '@/lib/validators';
import { sendEmail } from '@/lib/resend';
import { orderReadyEmail, orderDeliveredEmail } from '@/lib/email-templates';

export async function createJobAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const raw = JSON.parse(String(formData.get('payload')));
  const parsed = jobSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { finishings, ...job } = parsed.data;

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
    .select('id, job_number, status, quantity, unit_price, due_date, notes, customers(name, email), products(name)')
    .single<{
      id: string; job_number: string; status: string;
      quantity: number; unit_price: number; due_date: string | null; notes: string | null;
      customers: { name: string; email: string | null } | null;
      products: { name: string } | null;
    }>();
  if (error) return { ok: false, error: error.message };

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
    await sendEmail({ to: job.customers.email, ...tpl });
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
