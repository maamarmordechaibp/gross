import { PageHeader } from '@/components/app/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Company info, tax, and shop preferences" />
      <Card>
        <CardHeader><CardTitle>Company</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <Row k="Name" v={settings?.company_name} />
          <Row k="Email" v={settings?.company_email} />
          <Row k="Phone" v={settings?.company_phone} />
          <Row k="Currency" v={settings?.currency} />
          <Row k="Tax rate" v={settings?.tax_rate ? `${(Number(settings.tax_rate) * 100).toFixed(2)}%` : '—'} />
          <Row k="Rush surcharge" v={settings?.rush_multiplier ? `${(Number(settings.rush_multiplier) * 100).toFixed(0)}%` : '—'} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="font-medium">{v ?? '—'}</div>
    </div>
  );
}
