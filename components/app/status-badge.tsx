import { Badge } from '@/components/ui/badge';
import type { JobStatus, InvoiceStatus, QuoteStatus } from '@/types/database';

const JOB_VARIANTS: Record<JobStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'muted' | 'outline' }> = {
  estimate:   { label: 'Estimate',   variant: 'muted' },
  prepress:   { label: 'Prepress',   variant: 'secondary' },
  printing:   { label: 'Printing',   variant: 'default' },
  finishing:  { label: 'Finishing',  variant: 'warning' },
  completed:  { label: 'Completed',  variant: 'success' },
  delivered:  { label: 'Delivered',  variant: 'success' },
  cancelled:  { label: 'Cancelled',  variant: 'destructive' },
};

const INVOICE_VARIANTS: Record<InvoiceStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'muted' }> = {
  draft:   { label: 'Draft',   variant: 'muted' },
  sent:    { label: 'Sent',    variant: 'default' },
  partial: { label: 'Partial', variant: 'warning' },
  paid:    { label: 'Paid',    variant: 'success' },
  void:    { label: 'Void',    variant: 'destructive' },
};

const QUOTE_VARIANTS: Record<QuoteStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'muted' }> = {
  draft:    { label: 'Draft',    variant: 'muted' },
  sent:     { label: 'Sent',     variant: 'default' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  expired:  { label: 'Expired',  variant: 'warning' },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const v = JOB_VARIANTS[status];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const v = INVOICE_VARIANTS[status];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const v = QUOTE_VARIANTS[status];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

export function RushBadge({ dueDate }: { dueDate?: string | null }) {
  return (
    <Badge variant="destructive" className="gap-1">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive animate-pulse-dot" />
      Rush
    </Badge>
  );
}
