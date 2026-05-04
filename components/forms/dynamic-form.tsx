'use client';
import type { ProductFormField } from '@/types/database';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DynamicFormProps {
  fields: ProductFormField[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

export function DynamicForm({ fields, values, onChange }: DynamicFormProps) {
  function set(key: string, val: unknown) {
    onChange({ ...values, [key]: val });
  }

  if (!fields || fields.length === 0) {
    return <p className="text-sm text-muted-foreground">No additional specs for this product.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const v = values?.[f.key];
        if (f.type === 'select') {
          return (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>
                {f.label}{f.required && <span className="text-destructive"> *</span>}
              </Label>
              <select
                id={f.key}
                value={(v as string) ?? ''}
                onChange={(e) => set(f.key, e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required={f.required}
              >
                <option value="">Select…</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          );
        }
        if (f.type === 'number') {
          return (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>
                {f.label}{f.required && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                id={f.key} type="number"
                min={f.min} max={f.max}
                value={(v as number) ?? ''}
                onChange={(e) => set(f.key, e.target.valueAsNumber)}
                required={f.required}
              />
            </div>
          );
        }
        if (f.type === 'checkbox') {
          return (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox" checked={Boolean(v)}
                onChange={(e) => set(f.key, e.target.checked)}
                className="h-4 w-4 rounded border-input accent-[hsl(var(--primary))]"
              />
              {f.label}
            </label>
          );
        }
        return (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={f.key}>
              {f.label}{f.required && <span className="text-destructive"> *</span>}
            </Label>
            <Input id={f.key} value={(v as string) ?? ''} onChange={(e) => set(f.key, e.target.value)} required={f.required} />
          </div>
        );
      })}
    </div>
  );
}
