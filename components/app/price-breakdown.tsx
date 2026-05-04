import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { PriceBreakdown } from '@/lib/pricing/calculate';

interface PriceBreakdownProps {
  breakdown: PriceBreakdown;
  className?: string;
  /** When false, hide all cost / profit / margin info — show customer total only. */
  showInternals?: boolean;
}

export function PriceBreakdownCard({ breakdown, className, showInternals = true }: PriceBreakdownProps) {
  if (!showInternals) {
    return (
      <div className={cn('rounded-xl border bg-card p-5 shadow-sm space-y-3', className)}>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</div>
        <Row label="Subtotal" value={formatCurrency(breakdown.revenue)} />
        {breakdown.tax > 0 && <Row label="Tax" value={formatCurrency(breakdown.tax)} />}
        <div className="my-2 h-px bg-border" />
        <Row label="Total" value={formatCurrency(breakdown.revenue + breakdown.tax)} bold />
      </div>
    );
  }
  const positive = breakdown.profit >= 0;
  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow-sm space-y-3', className)}>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cost & Profit</div>
      <Row label="Paper"        value={formatCurrency(breakdown.paperCost)} />
      <Row label="Finishing"    value={formatCurrency(breakdown.finishingCost)} />
      <Row label="Labor / Setup" value={formatCurrency(breakdown.laborCost)} />
      <div className="my-2 h-px bg-border" />
      <Row label="Total cost" value={formatCurrency(breakdown.totalCost)} bold />
      <Row label="Revenue"    value={formatCurrency(breakdown.revenue)} bold />
      {breakdown.rushSurcharge > 0 && (
        <Row label="↳ incl. rush surcharge" value={formatCurrency(breakdown.rushSurcharge)} accent="warning" />
      )}
      {breakdown.tax > 0 && <Row label="Tax" value={formatCurrency(breakdown.tax)} />}
      <div className="my-2 h-px bg-border" />
      <Row
        label="Profit"
        value={`${formatCurrency(breakdown.profit)} (${breakdown.marginPct}%)`}
        accent={positive ? 'success' : 'destructive'}
        bold
      />
    </div>
  );
}

function Row({ label, value, accent, bold }: { label: string; value: string; accent?: 'success' | 'destructive' | 'warning'; bold?: boolean }) {
  const color =
    accent === 'success'    ? 'text-success' :
    accent === 'destructive' ? 'text-destructive' :
    accent === 'warning'    ? 'text-warning' : '';
  return (
    <div className={cn('flex items-center justify-between text-sm', bold && 'font-semibold', color)}>
      <span className={cn(!bold && !accent && 'text-muted-foreground')}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
