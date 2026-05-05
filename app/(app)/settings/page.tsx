import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { updateSettingsAction } from './actions';
import { MarginTiersEditor, type MarginTierRow } from '@/components/app/margin-tiers-editor';

async function action(formData: FormData) {
  'use server';
  await updateSettingsAction(formData);
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Company info, tax, margin, and shop preferences" />

      <Card>
        <CardHeader><CardTitle>Company</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <Row k="Name" v={settings?.company_name} />
          <Row k="Email" v={settings?.company_email} />
          <Row k="Phone" v={settings?.company_phone} />
          <Row k="Currency" v={settings?.currency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pricing</CardTitle></CardHeader>
        <CardContent>
          <form action={action} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tax_rate_pct">Tax rate (%)</Label>
                <Input
                  id="tax_rate_pct" name="tax_rate_pct" type="number" step="0.01" min={0}
                  defaultValue={settings?.tax_rate != null ? Number(settings.tax_rate) * 100 : 8.75}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rush_multiplier_pct">Rush surcharge (%)</Label>
                <Input
                  id="rush_multiplier_pct" name="rush_multiplier_pct" type="number" step="1" min={0}
                  defaultValue={settings?.rush_multiplier != null ? Number(settings.rush_multiplier) * 100 : 25}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Volume margin tiers</Label>
              <p className="text-xs text-muted-foreground">
                Each row sets the markup (over cost) starting at a quantity. A 1000-piece order
                walks through every tier — first 100 priced at tier 1, next 400 at tier 2, etc.
              </p>
              <MarginTiersEditor initial={(settings?.margin_tiers as MarginTierRow[]) ?? []} />
            </div>

            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="font-medium">{v ?? '—'}</div>
    </div>
  );
}
