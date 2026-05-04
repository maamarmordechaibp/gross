import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; positive?: boolean };
  icon?: LucideIcon;
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'secondary';
  className?: string;
}

const ACCENTS = {
  primary:     'bg-primary/10 text-primary',
  success:     'bg-success/10 text-success',
  warning:     'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  secondary:   'bg-secondary/10 text-secondary',
};

export function KpiCard({ label, value, delta, icon: Icon, accent = 'primary', className }: KpiCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tracking-tight tabular">{value}</div>
        </div>
        {Icon && (
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', ACCENTS[accent])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      {delta && (
        <div className={cn('mt-3 text-xs font-medium', delta.positive ? 'text-success' : 'text-destructive')}>
          {delta.positive ? '↑' : '↓'} {delta.value}
        </div>
      )}
    </div>
  );
}
