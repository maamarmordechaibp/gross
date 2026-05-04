'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

export async function createProductAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not authenticated' };

  const parsed = productCreateSchema.safeParse({
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
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };

  let fields: unknown = [];
  try { fields = JSON.parse(parsed.data.fields_json); } catch { return { ok: false as const, error: 'Invalid fields JSON' }; }
  const fieldsParsed = z.array(fieldSchema).safeParse(fields);
  if (!fieldsParsed.success) return { ok: false as const, error: 'Field schema invalid: ' + fieldsParsed.error.issues[0].message };

  const default_specs: Record<string, unknown> = {};
  if (parsed.data.piece_w && parsed.data.piece_h) {
    default_specs.piece_size = { w: parsed.data.piece_w, h: parsed.data.piece_h };
  }

  const { data, error } = await supabase.from('products').insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    category: parsed.data.category,
    description: parsed.data.description,
    base_price: parsed.data.base_price,
    active: parsed.data.active,
    default_specs,
    schema: { fields: fieldsParsed.data },
  }).select('id').single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/products');
  redirect(`/products`);
}
