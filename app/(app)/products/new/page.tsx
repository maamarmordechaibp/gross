import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SpecFieldsBuilder } from '@/components/app/spec-fields-builder';
import { createProductAction } from '../actions';

async function action(formData: FormData) {
  'use server';
  await createProductAction(formData);
}

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New product" description="Catalog item with default piece size and dynamic spec fields">
        <Button asChild variant="outline" size="sm"><Link href="/products"><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
      </PageHeader>
      <Card className="max-w-3xl">
        <CardHeader><CardTitle>Product details</CardTitle></CardHeader>
        <CardContent>
          <form action={action} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required placeholder="Business Cards" /></div>
              <div className="space-y-1.5"><Label htmlFor="slug">Slug *</Label>
                <Input id="slug" name="slug" required placeholder="business-cards" pattern="[a-z0-9-]+" /></div>
              <div className="space-y-1.5"><Label htmlFor="category">Category</Label>
                <Input id="category" name="category" placeholder="Marketing" /></div>
              <div className="space-y-1.5"><Label htmlFor="base_price">Base price (USD)</Label>
                <Input id="base_price" name="base_price" type="number" step="0.01" min={0} defaultValue={0} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} /></div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold">Default piece size</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Used by the order form to auto-calculate sheets needed and the imposition diagram.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="piece_w">Width (in)</Label>
                  <Input id="piece_w" name="piece_w" type="number" step="0.0625" min={0} placeholder="3.5" /></div>
                <div className="space-y-1.5"><Label htmlFor="piece_h">Height (in)</Label>
                  <Input id="piece_h" name="piece_h" type="number" step="0.0625" min={0} placeholder="2" /></div>
              </div>
            </div>

            <div>
              <h3 className="mb-1 text-sm font-semibold">Spec fields</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Customers will fill these in on the order form (e.g. paper weight, color count, finish).
              </p>
              <SpecFieldsBuilder name="fields_json" />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked /> Active (orderable)
            </label>

            <Button type="submit">Create product</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
