'use client';
import { useEffect, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useDroppable, useDraggable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn, formatDate } from '@/lib/utils';
import { JobStatusBadge, RushBadge } from '@/components/app/status-badge';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { updateJobStatusAction } from '@/app/(app)/orders/actions';
import type { JobFull, JobStatus } from '@/types/database';

const COLUMNS: { id: JobStatus; label: string }[] = [
  { id: 'estimate',  label: 'Estimate' },
  { id: 'prepress',  label: 'Prepress' },
  { id: 'printing',  label: 'Printing' },
  { id: 'finishing', label: 'Finishing' },
  { id: 'completed', label: 'Completed' },
  { id: 'delivered', label: 'Delivered' },
];

interface Props {
  initialJobs: JobFull[];
}

export function KanbanBoard({ initialJobs }: Props) {
  const [jobs, setJobs] = useState<JobFull[]>(initialJobs);
  const [active, setActive] = useState<JobFull | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // Realtime sync
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel('production-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, async () => {
        const { data } = await supabase
          .from('v_job_full')
          .select('*')
          .neq('status', 'cancelled')
          .order('due_date', { ascending: true, nullsFirst: false })
          .returns<JobFull[]>();
        if (data) setJobs(data);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function onDragStart(e: DragStartEvent) {
    const j = jobs.find((x) => x.id === e.active.id);
    if (j) setActive(j);
  }

  async function onDragEnd(e: DragEndEvent) {
    setActive(null);
    if (!e.over) return;
    const jobId = String(e.active.id);
    const newStatus = String(e.over.id) as JobStatus;
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status === newStatus) return;
    // Optimistic
    setJobs((s) => s.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j)));
    const res = await updateJobStatusAction(jobId, newStatus);
    if (!res.ok) {
      toast.error(res.error ?? 'Update failed');
      setJobs((s) => s.map((j) => (j.id === jobId ? { ...j, status: job.status } : j)));
    } else {
      toast.success(`Moved ${job.job_number} → ${newStatus}`);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex snap-x gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const items = jobs.filter((j) => j.status === col.id);
          return (
            <Column key={col.id} id={col.id} label={col.label} count={items.length}>
              {items.map((j) => <JobCard key={j.id} job={j} />)}
            </Column>
          );
        })}
      </div>
      <DragOverlay>{active && <JobCard job={active} dragging />}</DragOverlay>
    </DndContext>
  );
}

function Column({ id, label, count, children }: { id: JobStatus; label: string; count: number; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div className="flex w-72 shrink-0 snap-start flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[60vh] flex-1 flex-col gap-2 rounded-xl border-2 border-dashed bg-muted/30 p-2 transition-colors',
          isOver && 'border-primary bg-primary/5',
        )}
      >
        {children}
        {count === 0 && <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Drop jobs here</div>}
      </div>
    </div>
  );
}

function JobCard({ job, dragging }: { job: JobFull; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: job.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow active:cursor-grabbing',
        (isDragging || dragging) && 'opacity-50',
        'hover:shadow-md',
      )}
    >
      <div className="flex items-center justify-between">
        <Link href={`/orders/${job.id}`} className="font-mono text-[11px] text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
          {job.job_number}
        </Link>
        {job.is_rush && <RushBadge />}
      </div>
      <div className="mt-1.5 truncate text-sm font-medium">{job.product_name}</div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">{job.customer_name}</div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>qty {job.quantity}</span>
        <span>{job.due_date ? formatDate(job.due_date, { month: 'short', day: 'numeric' }) : 'no due'}</span>
      </div>
    </div>
  );
}
