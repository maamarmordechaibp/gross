import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/files/sign
 * Body: { path: string, expiresIn?: number }
 * Returns a short-lived signed URL for the requested object in the
 * `job-files` bucket. RLS on `storage.objects` enforces access.
 */
export async function POST(req: Request) {
  const { path, expiresIn = 60 * 10 } = await req.json();
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from('job-files')
    .createSignedUrl(path, expiresIn);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ url: data.signedUrl });
}
