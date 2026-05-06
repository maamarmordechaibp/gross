'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/permissions';

const fieldSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/i, 'Use letters, numbers, and underscores'),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'select', 'checkbox']),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

const productCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, dashes only'),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  base_price: z.coerce.number().nonnegative(),
  piece_w: z.coerce.number().nonnegative().optional(),
  piece_h: z.coerce.number().nonnegative().optional(),
  fields_json: z.string().default('[]'),
  active: z.coerce.boolean().default(true),
});

function parseProductForm(formData: FormData) {
  return productCreateSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    category: formData.get('category') || null,
    description: formData.get('description') || null,
    base_price: formData.get('base_price') || 0,
    piece_w: formData.get('piece_w') || undefined,
    piece_h: formData.get('piece_h') || undefined,
    fields_json: formData.get('fields_json') || '[]',
    active: formData.get('active') === 'on',
  });
}

function buildProductPayload(d: z.infer<typeof productCreateSchema>) {
  let fields: unknown = [];
  try { fields = JSON.parse(d.fields_json); } catch { return { error: 'Invalid fields JSON' as const }; }
  const fieldsParsed = z.array(fieldSchema).safeParse(fields);
  if (!fieldsParsed.success) return { error: 'Field schema invalid: ' + fieldsParsed.error.issues[0].message };

  const default_specs: Record<string, unknown> = {};
  if (d.piece_w && d.piece_h) default_specs.piece_size = { w: d.piece_w, h: d.piece_h };

  return {
    payload: {
      name: d.name,
      slug: d.slug,
      category: d.category ?? null,
      description: d.description ?? null,
      base_price: d.base_price,
      active: d.active,
      default_specs,
      schema: { fields: fieldsParsed.data },
    },
  };
}

export async function createProductAction(formData: FormData) {
  await requireRole('manager');
  const supabase = await createSupabaseServerClient();

  const parsed = parseProductForm(formData);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const built = buildProductPayload(parsed.data);
  if ('error' in built) return { ok: false as const, error: built.error };

  const { data, error } = await supabase.from('products').insert(built.payload).select('id').single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/products');
  redirect(`/products/${data!.id}`);
}

export async function updateProductAction(formData: FormData) {
  await requireRole('manager');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false as const, error: 'Missing id' };

  const parsed = parseProductForm(formData);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const built = buildProductPayload(parsed.data);
  if ('error' in built) return { ok: false as const, error: built.error };

  const { error } = await supabase.from('products').update(built.payload).eq('id', id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
  redirect(`/products/${id}`);
}

export async function archiveProductAction(formData: FormData) {
  await requireRole('manager');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false as const, error: 'Missing id' };
  const { error } = await supabase
    .from('products')
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq('id', id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/products');
  return { ok: true as const };
}

export async function restoreProductAction(formData: FormData) {
  await requireRole('manager');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  const { error } = await supabase.from('products').update({ archived_at: null, active: true }).eq('id', id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/products');
  return { ok: true as const };
}

/** Duplicate a product as a draft (slug-suffixed). */
export async function duplicateProductAction(formData: FormData) {
  await requireRole('manager');
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false as const, error: 'Missing id' };

  const { data: src, error: e1 } = await supabase
    .from('products').select('*').eq('id', id).single<{
      name: string; slug: string; category: string | null; description: string | null;
      default_specs: Record<string, unknown>; schema: Record<string, unknown>; base_price: number;
    }>();
  if (e1 || !src) return { ok: false as const, error: e1?.message ?? 'Not found' };

  const newSlug = `${src.slug}-copy-${Date.now().toString(36)}`;
  const { data, error } = await supabase.from('products').insert({
    ...src,
    name: src.name + ' (copy)',
    slug: newSlug,
    active: false,
  }).select('id').single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/products');
  redirect(`/products/${data!.id}`);
}
