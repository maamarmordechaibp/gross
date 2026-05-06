'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Flame, CheckCircle2, Truck, Printer, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { JobStatusBadge } from '@/components/app/status-badge';
import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { assignPrinterAction, updateJobStatusAction, bulkUpdateJobStatusAction, bulkAssignPrinterAction } from '@/app/(app)/orders/actions';
import { PRINTERS } from '@/lib/printers';
import type { JobFull, JobStatus } from '@/types/database';

const STAGES: { id: JobStatus; label: string }[] = [
  { id: 'estimate',  label: 'Estimates' },
  { id: 'prepress',  label: 'Prepress' },
  { id: 'printing',  label: 'On press' },
  { id: 'finishing', label: 'Finishing' },
];

const NEXT: Record<JobStatus, { to: JobStatus; label: string; icon: React.ComponentType<{ className?: string }> } | null> = {
  estimate:  { to: 'prepress',  label: 'Start prepress', icon: Printer },
  prepress:  { to: 'printing',  label: 'Send to press',  icon: Printer },
  printing:  { to: 'finishing', label: 'Mark printed',   icon: CheckCircle2 },
  finishing: { to: 'completed', label: 'Mark ready',     icon: CheckCircle2 },
  completed: { to: 'delivered', label: 'Mark delivered', icon: Truck },
  delivered: null,
  cancelled: null,
};

export function Worklist({ initialJobs }: { initialJobs: JobFull[] }) {
  const [jobs, setJobs] = useState<JobFull[]>(initialJobs);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll(ids: string[], on: boolean) {
    setSelected((s) => { const n = new Set(s); ids.forEach((id) => on ? n.add(id) : n.delete(id)); return n; });
  }
  function bulkAdvance(stageJobs: JobFull[]) {
    const ids = stageJobs.filter((j) => selected.has(j.id)).map((j) => j.id);
    if (ids.length === 0) return;
    const next = NEXT[stageJobs[0].status];
    if (!next) return;
    startTransition(async () => {
      const res = await bulkUpdateJobStatusAction(ids, next.to);
      if (res.ok) { toast.success(`Advanced ${ids.length} jobs to ${next.to}`); setSelected(new Set()); }
      else toast.error(res.error ?? 'Bulk update failed');
    });
  }
  function bulkAssign(stageJobs: JobFull[], printer: string) {
    const ids = stageJobs.filter((j) => selected.has(j.id)).map((j) => j.id);
    if (ids.length === 0 || !printer) return;
    startTransition(async () => {
      const res = await bulkAssignPrinterAction(ids, printer);
      if (res.ok) { toast.success(`Assigned ${printer} to ${ids.length} jobs`); setJobs((js) => js.map((j) => ids.includes(j.id) ? { ...j, printer } : j)); setSelected(new Set()); }
      else toast.error(res.error ?? 'Bulk assign failed');
    });
  }

  // Live refresh on any job change
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const ch = supabase
      .channel('worklist-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, async () => {
        const { data } = await supabase
          .from('v_job_full').select('*')
          .in('status', ['estimate', 'prepress', 'printing', 'finishing'])
          .order('is_rush', { ascending: false })
          .order('due_date', { ascending: true, nullsFirst: false })
          .returns<JobFull[]>();
        if (data) setJobs(data);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  function setPrinter(jobId: string, printer: string) {
    setJobs((js) => js.map((j) => j.id === jobId ? { ...j, printer: printer || null } : j));
    startTransition(async () => {
      const res = await assignPrinterAction(jobId, printer);
      if (!res.ok) toast.error(res.error);
    });
  }

  function advance(job: JobFull) {
    const next = NEXT[job.status];
    if (!next) return;
    setBusyId(job.id);
    startTransition(async () => {
      const res = await updateJobStatusAction(job.id, next.to);
      setBusyId(null);
      if (res.ok) {
        toast.success(`${job.job_number}: ${next.label}`);
        setJobs((js) => js.filter((j) => j.id !== job.id || ['estimate', 'prepress', 'printing', 'finishing'].includes(next.to)));
      } else {
        toast.error(res.error ?? 'Update failed');
      }
    });
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
        No jobs in production. Take a break ☕
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {STAGES.map((stage) => {
        const list = jobs.filter((j) => j.status === stage.id);
        if (list.length === 0) return null;
        const stageIds = list.map((j) => j.id);
        const allSelected = stageIds.every((id) => selected.has(id));
        const someSelected = stageIds.some((id) => selected.has(id));
        const stageNext = NEXT[stage.id];
        return (
          <section key={stage.id}>
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{stage.label}</h2>
              <span className="text-xs text-muted-foreground tabular">{list.length}</span>
              {someSelected && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{stageIds.filter((id) => selected.has(id)).length} selected</span>
                  <select onChange={(e) => { if (e.target.value) { bulkAssign(list, e.target.value); e.target.value = ''; } }} className="h-7 rounded-md border border-input bg-background px-2 text-xs">
                    <option value="">Bulk assign press…</option>
                    {PRINTERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {stageNext && <Button size="sm" variant="outline" onClick={() => bulkAdvance(list)} disabled={pending}>{stageNext.label} (bulk)</Button>}
                </div>
              )}
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="w-8 px-3 py-2"><input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(stageIds, e.target.checked)} /></th>
                    <th className="px-3 py-2">Job</th>
                    <th className="px-3 py-2">Customer / Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">Printer</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map((job) => {
                    const next = NEXT[job.status];
                    const overdue = job.due_date && new Date(job.due_date) < new Date();
                    return (
                      <tr key={job.id} className={cn(job.is_rush && 'bg-destructive/5')}>
                        <td className="px-3 py-2"><input type="checkbox" checked={selected.has(job.id)} onChange={() => toggle(job.id)} /></td>
                        <td className="px-3 py-2">
                          <Link href={`/orders/${job.id}`} className="block font-mono text-[11px] text-primary hover:underline">{job.job_number}</Link>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <JobStatusBadge status={job.status} />
                            {job.is_rush && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-destructive">
                                <Flame className="h-3 w-3" /> rush
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{job.customer_name}</div>
                          <div className="text-xs text-muted-foreground">{job.product_name}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular">{job.quantity}</td>
                        <td className="px-3 py-2">
                          {job.due_date ? (
                            <span className={cn('inline-flex items-center gap-1 text-xs', overdue && 'text-destructive font-medium')}>
                              {overdue && <AlertTriangle className="h-3 w-3" />}
                              {formatDate(job.due_date, { month: 'short', day: 'numeric' })}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={job.printer ?? ''}
                            onChange={(e) => setPrinter(job.id, e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <option value="">— assign press —</option>
                            {PRINTERS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {next && (
                            <Button
                              size="sm"
                              variant={job.status === 'printing' ? 'default' : 'outline'}
                              onClick={() => advance(job)}
                              disabled={pending && busyId === job.id}
                            >
                              <next.icon className="h-3.5 w-3.5" />
                              {busyId === job.id ? 'Updating…' : next.label}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
