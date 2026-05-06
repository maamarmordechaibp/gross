import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SpecFieldsBuilder } from '@/components/app/spec-fields-builder';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateProductAction } from '../../actions';
import type { Product } from '@/types/database';

async function update(formData: FormData) {
  'use server';
  await updateProductAction(formData);
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: p } = await supabase.from('products').select('*').eq('id', id).maybeSingle<Product>();
  if (!p) notFound();
  const piece = (p.default_specs as { piece_size?: { w: number; h: number } } | null)?.piece_size;
  const fields = ((p.schema as { fields?: Array<{ key: string; label: string; type: 'text' | 'number' | 'select' | 'checkbox'; options?: string[]; required?: boolean }> } | null)?.fields ?? []);

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${p.name}`}>
        <Button asChild variant="outline" size="sm"><Link href={`/products/${p.id}`}><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
      </PageHeader>
      <Card className="max-w-3xl">
        <CardHeader><CardTitle>Product details</CardTitle></CardHeader>
        <CardContent>
          <form action={update} className="space-y-5">
            <input type="hidden" name="id" value={p.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required defaultValue={p.name} /></div>
              <div className="space-y-1.5"><Label htmlFor="slug">Slug *</Label>
                <Input id="slug" name="slug" required pattern="[a-z0-9-]+" defaultValue={p.slug} /></div>
              <div className="space-y-1.5"><Label htmlFor="category">Category</Label>
                <Input id="category" name="category" defaultValue={p.category ?? ''} /></div>
              <div className="space-y-1.5"><Label htmlFor="base_price">Base price (USD)</Label>
                <Input id="base_price" name="base_price" type="number" step="0.01" min={0} defaultValue={p.base_price} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} defaultValue={p.description ?? ''} /></div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold">Default piece size</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="piece_w">Width (in)</Label>
                  <Input id="piece_w" name="piece_w" type="number" step="0.0625" min={0} defaultValue={piece?.w ?? ''} /></div>
                <div className="space-y-1.5"><Label htmlFor="piece_h">Height (in)</Label>
                  <Input id="piece_h" name="piece_h" type="number" step="0.0625" min={0} defaultValue={piece?.h ?? ''} /></div>
              </div>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-semibold">Spec fields</h3>
              <SpecFieldsBuilder name="fields_json" defaultValue={fields} />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={p.active !== false} /> Active (orderable)
            </label>

            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
