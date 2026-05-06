import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isStaff } from '@/lib/supabase/role';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice } from '@/types/database';

export const dynamic = 'force-dynamic';

interface LineItem { description: string; qty: number; unit_price: number; amount: number; }

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isStaff())) return <div>Not authorized</div>;
  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase
    .from('invoices')
    .select('*, customers(name, company, email, phone)')
    .eq('id', id)
    .maybeSingle<Invoice & { customers: { name: string; company: string | null; email: string | null; phone: string | null } }>();
  if (!inv) notFound();
  const { data: payments } = await supabase.from('payments').select('*').eq('invoice_id', id).order('paid_at');
  const { data: settingsRaw } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
  const settings = settingsRaw as { company_name?: string; company_email?: string; company_phone?: string; company_address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string } | null } | null;
  const companyAddress = settings?.company_address ? [settings.company_address.line1, settings.company_address.line2, [settings.company_address.city, settings.company_address.state, settings.company_address.postal_code].filter(Boolean).join(', ')].filter(Boolean).join('\n') : null;
  const items = ((inv as unknown as { line_items?: LineItem[] | null }).line_items) ?? [];
  const outstanding = Number(inv.total) - Number(inv.amount_paid);

  return (
    <>
      <div className="header row">
        <div>
          <h1>Invoice</h1>
          <div style={{ fontFamily: 'monospace', fontSize: 14 }}>{inv.invoice_number}</div>
        </div>
        <div className="right">
          {settings?.company_name && <div className="value">{settings.company_name}</div>}
          {companyAddress && <div style={{ fontSize: 12, whiteSpace: 'pre-line' }}>{companyAddress}</div>}
          {settings?.company_email && <div style={{ fontSize: 12 }}>{settings.company_email}</div>}
        </div>
      </div>

      <div className="grid" style={{ marginTop: 16 }}>
        <div>
          <div className="label">Bill to</div>
          <div className="value">{inv.customers.name}</div>
          {inv.customers.company && <div>{inv.customers.company}</div>}
          {inv.customers.email && <div style={{ fontSize: 12, color: '#555' }}>{inv.customers.email}</div>}
        </div>
        <div className="right">
          <div className="label">Issued</div><div>{formatDate(inv.created_at)}</div>
          {inv.due_date && (<><div className="label" style={{ marginTop: 6 }}>Due</div><div>{formatDate(inv.due_date)}</div></>)}
          <div className="label" style={{ marginTop: 6 }}>Status</div><div className="value" style={{ textTransform: 'uppercase' }}>{inv.status}</div>
        </div>
      </div>

      <h2>Line items</h2>
      <table>
        <thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Unit</th><th className="right">Amount</th></tr></thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={4} style={{ color: '#999' }}>{inv.notes ?? 'See attached'}</td></tr>
          ) : items.map((li, i) => (
            <tr key={i}>
              <td>{li.description}</td>
              <td className="right">{Number(li.qty).toLocaleString()}</td>
              <td className="right">{formatCurrency(li.unit_price)}</td>
              <td className="right">{formatCurrency(li.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="totals" style={{ marginTop: 16, marginLeft: 'auto', width: '50%' }}>
        <tbody>
          <tr><td>Subtotal</td><td className="right">{formatCurrency(inv.subtotal)}</td></tr>
          <tr><td>Tax</td><td className="right">{formatCurrency(inv.tax)}</td></tr>
          <tr><td>Total</td><td className="right">{formatCurrency(inv.total)}</td></tr>
          {Number(inv.amount_paid) > 0 && <tr><td>Paid</td><td className="right">−{formatCurrency(inv.amount_paid)}</td></tr>}
          <tr><td>{outstanding > 0 ? 'Balance due' : 'Paid in full'}</td><td className="right">{formatCurrency(outstanding)}</td></tr>
        </tbody>
      </table>

      {(payments?.length ?? 0) > 0 && (<>
        <h2>Payments</h2>
        <table>
          <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="right">Amount</th></tr></thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id}><td>{formatDate(p.paid_at)}</td><td>{p.method}</td><td>{p.reference ?? ''}</td><td className="right">{formatCurrency(p.amount)}</td></tr>
            ))}
          </tbody>
        </table>
      </>)}

      {inv.notes && (<><h2>Notes</h2><p style={{ whiteSpace: 'pre-line', fontSize: 12 }}>{inv.notes}</p></>)}

      <div className="footer">Thank you for your business.</div>
      <script dangerouslySetInnerHTML={{ __html: 'setTimeout(()=>window.print(),300)' }} />
    </>
  );
}
