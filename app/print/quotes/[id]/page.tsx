import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isStaff } from '@/lib/supabase/role';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Quote, QuoteLineItem } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isStaff())) return <div>Not authorized</div>;
  const supabase = await createSupabaseServerClient();
  const { data: q } = await supabase
    .from('quotes')
    .select('*, customers(name, company, email)')
    .eq('id', id)
    .maybeSingle<Quote & { customers: { name: string; company: string | null; email: string | null } }>();
  if (!q) notFound();
  const { data: settingsRaw } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
  const settings = settingsRaw as { company_name?: string; company_email?: string; company_address?: { line1?: string; city?: string; state?: string; postal_code?: string } | null } | null;
  const items: QuoteLineItem[] = q.line_items ?? [];

  return (
    <>
      <div className="header row">
        <div>
          <h1>Quote</h1>
          <div style={{ fontFamily: 'monospace', fontSize: 14 }}>{q.quote_number}</div>
        </div>
        <div className="right">
          {settings?.company_name && <div className="value">{settings.company_name}</div>}
          {settings?.company_email && <div style={{ fontSize: 12 }}>{settings.company_email}</div>}
        </div>
      </div>

      <div className="grid" style={{ marginTop: 16 }}>
        <div>
          <div className="label">For</div>
          <div className="value">{q.customers.name}</div>
          {q.customers.company && <div>{q.customers.company}</div>}
          {q.customers.email && <div style={{ fontSize: 12, color: '#555' }}>{q.customers.email}</div>}
        </div>
        <div className="right">
          <div className="label">Issued</div><div>{formatDate(q.created_at)}</div>
          {q.valid_until && (<><div className="label" style={{ marginTop: 6 }}>Valid until</div><div>{formatDate(q.valid_until)}</div></>)}
          <div className="label" style={{ marginTop: 6 }}>Status</div><div className="value" style={{ textTransform: 'uppercase' }}>{q.status}</div>
        </div>
      </div>

      <h2>Line items</h2>
      <table>
        <thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Unit</th><th className="right">Total</th></tr></thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={4} style={{ color: '#999' }}>{q.notes ?? 'See attached'}</td></tr>
          ) : items.map((li, i) => (
            <tr key={i}>
              <td>{li.description}</td>
              <td className="right">{Number(li.qty).toLocaleString()}</td>
              <td className="right">{formatCurrency(li.unit_price)}</td>
              <td className="right">{formatCurrency(li.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="totals" style={{ marginTop: 16, marginLeft: 'auto', width: '50%' }}>
        <tbody>
          <tr><td>Subtotal</td><td className="right">{formatCurrency(q.subtotal)}</td></tr>
          <tr><td>Tax</td><td className="right">{formatCurrency(q.tax)}</td></tr>
          <tr><td>Total</td><td className="right">{formatCurrency(q.total)}</td></tr>
        </tbody>
      </table>

      {q.notes && (<><h2>Notes</h2><p style={{ whiteSpace: 'pre-line', fontSize: 12 }}>{q.notes}</p></>)}

      <div className="footer">This quote is valid for 30 days from the issue date unless otherwise noted.</div>
      <script dangerouslySetInnerHTML={{ __html: 'setTimeout(()=>window.print(),300)' }} />
    </>
  );
}
