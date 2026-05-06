import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isStaff } from '@/lib/supabase/role';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { JobFull } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function JobTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isStaff())) return <div>Not authorized</div>;
  const supabase = await createSupabaseServerClient();
  const { data: job } = await supabase.from('v_job_full').select('*').eq('id', id).maybeSingle<JobFull>();
  if (!job) notFound();
  const { data: fins } = await supabase.from('job_finishings').select('qty, finishing_options(name, type)').eq('job_id', id);

  return (
    <>
      <div className="header row">
        <div>
          <h1>Job Ticket</h1>
          <div style={{ fontFamily: 'monospace', fontSize: 14 }}>{job.job_number}</div>
          {job.is_rush && <div className="badge" style={{ marginTop: 6 }}>RUSH</div>}
        </div>
        <div className="right">
          <div className="label">Created</div><div>{formatDate(job.created_at)}</div>
          <div className="label" style={{ marginTop: 6 }}>Due</div>
          <div>{job.due_date ? formatDate(job.due_date) : '—'}</div>
        </div>
      </div>

      <h2>Customer</h2>
      <div className="grid">
        <div><div className="label">Name</div><div className="value">{job.customer_name}</div></div>
        <div><div className="label">Status</div><div className="value">{job.status}</div></div>
      </div>

      <h2>Production</h2>
      <div className="grid">
        <div><div className="label">Item</div><div className="value">{job.product_name}</div></div>
        <div><div className="label">Quantity</div><div className="value">{job.quantity.toLocaleString()}</div></div>
        <div><div className="label">Paper</div><div className="value">{job.paper_name ? `${job.paper_name} (${job.paper_size})` : '—'}</div></div>
        <div><div className="label">Sheets</div><div className="value">{(job.paper_qty ?? 0).toLocaleString()}</div></div>
        <div><div className="label">Printer</div><div className="value">{job.printer ?? '—'}</div></div>
        <div><div className="label">Assignee</div><div className="value">{job.assignee_name ?? 'Unassigned'}</div></div>
      </div>

      {Object.keys(job.specs ?? {}).length > 0 && (<>
        <h2>Specifications</h2>
        <table><tbody>
          {Object.entries(job.specs as Record<string, unknown>).map(([k, v]) => (
            <tr key={k}><th style={{ width: '30%' }}>{k}</th><td>{String(v)}</td></tr>
          ))}
        </tbody></table>
      </>)}

      {(fins?.length ?? 0) > 0 && (<>
        <h2>Finishings</h2>
        <table>
          <thead><tr><th>Finish</th><th>Type</th><th className="right">Qty</th></tr></thead>
          <tbody>
            {(fins as unknown as Array<{ qty: number; finishing_options: { name: string; type: string } | null }>).map((f, i) => (
              <tr key={i}><td>{f.finishing_options?.name ?? '—'}</td><td>{f.finishing_options?.type ?? ''}</td><td className="right">{f.qty}</td></tr>
            ))}
          </tbody>
        </table>
      </>)}

      {job.notes && (<><h2>Customer notes</h2><p style={{ whiteSpace: 'pre-line' }}>{job.notes}</p></>)}
      {job.internal_notes && (<><h2>Internal notes</h2><p style={{ whiteSpace: 'pre-line' }}>{job.internal_notes}</p></>)}

      <h2>Pricing</h2>
      <div className="grid">
        <div><div className="label">Unit price</div><div className="value">{formatCurrency(job.unit_price)}</div></div>
        <div><div className="label">Revenue</div><div className="value">{formatCurrency(job.revenue ?? 0)}</div></div>
      </div>

      <div className="footer row">
        <span>Sign off:</span>
        <span>______________________________</span>
      </div>
      <script dangerouslySetInnerHTML={{ __html: 'setTimeout(()=>window.print(),300)' }} />
    </>
  );
}
