import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createPaperStockAction } from '../actions';

async function action(formData: FormData) {
  'use server';
  await createPaperStockAction(formData);
}

export default function NewPaperStockPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Add paper stock" description="Define a new paper and (optionally) record the first receipt">
        <Button asChild variant="outline" size="sm"><Link href="/inventory"><ArrowLeft className="h-3.5 w-3.5" />Back</Link></Button>
      </PageHeader>
      <Card className="max-w-3xl">
        <CardHeader><CardTitle>Stock details</CardTitle></CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required placeholder="100lb Gloss Cover" /></div>
              <div className="space-y-1.5"><Label htmlFor="size">Sheet size (WxH inches) *</Label>
                <Input id="size" name="size" required placeholder="12x18" pattern="\d+(\.\d+)?\s*[x×]\s*\d+(\.\d+)?" />
              </div>
              <div className="space-y-1.5"><Label htmlFor="weight_gsm">Weight (gsm)</Label>
                <Input id="weight_gsm" name="weight_gsm" type="number" min={0} /></div>
              <div className="space-y-1.5"><Label htmlFor="color">Color</Label>
                <Input id="color" name="color" placeholder="White" /></div>
              <div className="space-y-1.5"><Label htmlFor="finish">Finish</Label>
                <Input id="finish" name="finish" placeholder="Gloss / Matte / Uncoated" /></div>
              <div className="space-y-1.5"><Label htmlFor="reorder_threshold">Reorder threshold</Label>
                <Input id="reorder_threshold" name="reorder_threshold" type="number" min={0} defaultValue={500} /></div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="mb-3 text-sm font-semibold">Ink cost per piece (USD)</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="ink_bw_1side">Black &amp; white — 1 side</Label>
                  <Input id="ink_bw_1side" name="ink_bw_1side" type="number" step="0.0001" min={0} defaultValue={0.015} /></div>
                <div className="space-y-1.5"><Label htmlFor="ink_bw_2side">Black &amp; white — 2 sides</Label>
                  <Input id="ink_bw_2side" name="ink_bw_2side" type="number" step="0.0001" min={0} defaultValue={0.030} /></div>
                <div className="space-y-1.5"><Label htmlFor="ink_color_1side">Full color — 1 side</Label>
                  <Input id="ink_color_1side" name="ink_color_1side" type="number" step="0.0001" min={0} defaultValue={0.080} /></div>
                <div className="space-y-1.5"><Label htmlFor="ink_color_2side">Full color — 2 sides</Label>
                  <Input id="ink_color_2side" name="ink_color_2side" type="number" step="0.0001" min={0} defaultValue={0.160} /></div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Per-piece ink/toner cost for this paper. The auto-price engine picks the matching value based on color &amp; sides on the order.</p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="mb-3 text-sm font-semibold">Initial receipt (optional)</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="qty_on_hand">Quantity received</Label>
                  <Input id="qty_on_hand" name="qty_on_hand" type="number" min={0} defaultValue={0} /></div>
                <div className="space-y-1.5"><Label htmlFor="unit_cost">Unit cost (USD/sheet)</Label>
                  <Input id="unit_cost" name="unit_cost" type="number" step="0.0001" min={0} defaultValue={0} /></div>
                <div className="space-y-1.5"><Label htmlFor="supplier">Supplier</Label>
                  <Input id="supplier" name="supplier" /></div>
                <div className="space-y-1.5"><Label htmlFor="reference">Reference / PO #</Label>
                  <Input id="reference" name="reference" /></div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">If qty &gt; 0 we'll create a paper_receipts row, which auto-updates on-hand quantity and weighted-average cost per sheet.</p>
            </div>

            <Button type="submit">Save stock</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
