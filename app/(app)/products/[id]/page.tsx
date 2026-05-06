import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Copy } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArchiveButton } from '@/components/app/archive-button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { archiveProductAction, restoreProductAction, duplicateProductAction } from '../actions';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/types/database';

async function duplicate(formData: FormData) {
  'use server';
  await duplicateProductAction(formData);
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: p } = await supabase.from('products').select('*').eq('id', id).maybeSingle<Product>();
  if (!p) notFound();
  const fields = ((p.schema as { fields?: Array<{ key: string; label: string; type: string; options?: string[]; required?: boolean }> } | null)?.fields ?? []);
  const piece = (p.default_specs as { piece_size?: { w: number; h: number } } | null)?.piece_size;

  return (
    <div className="space-y-6">
      <PageHeader title={p.name} description={p.category ?? undefined}>
        <Button asChild variant="outline" size="sm"><Link href="/products"><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href={`/products/${p.id}/edit`}><Pencil className="h-3.5 w-3.5" />Edit</Link></Button>
        <form action={duplicate}>
          <input type="hidden" name="id" value={p.id} />
          <Button type="submit" variant="outline" size="sm"><Copy className="h-3.5 w-3.5" />Duplicate</Button>
        </form>
        {p.archived_at
          ? <ArchiveButton action={restoreProductAction} hiddenFields={{ id: p.id }} label="Restore" confirmText="Restore product?" />
          : <ArchiveButton action={archiveProductAction} hiddenFields={{ id: p.id }} redirectTo="/products" />}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground">Base price</div>
          <div className="text-lg font-semibold tabular">{formatCurrency(p.base_price)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="mt-1"><Badge variant={p.active === false ? 'warning' : 'success'}>{p.active === false ? 'Inactive' : 'Active'}</Badge></div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs text-muted-foreground">Default piece</div>
          <div className="text-sm font-medium">{piece ? `${piece.w}″ × ${piece.h}″` : '—'}</div>
        </CardContent></Card>
      </div>

      {p.description && (
        <Card><CardContent className="py-5"><p className="text-sm">{p.description}</p></CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle>Spec fields</CardTitle></CardHeader>
        <CardContent>
          {fields.length === 0 ? <p className="text-sm text-muted-foreground">No spec fields defined.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr>
                <th className="py-1.5">Key</th><th className="py-1.5">Label</th><th className="py-1.5">Type</th><th className="py-1.5">Options</th><th className="py-1.5">Required</th>
              </tr></thead>
              <tbody className="divide-y">
                {fields.map((f) => (
                  <tr key={f.key}>
                    <td className="py-1.5 font-mono text-xs">{f.key}</td>
                    <td className="py-1.5">{f.label}</td>
                    <td className="py-1.5 capitalize">{f.type}</td>
                    <td className="py-1.5 text-muted-foreground">{(f.options ?? []).join(', ') || '—'}</td>
                    <td className="py-1.5">{f.required ? 'Yes' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
