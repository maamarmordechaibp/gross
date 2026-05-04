'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

export interface SpecField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  required?: boolean;
  options?: string[];
}

interface Props {
  /** Hidden input name that will receive JSON.stringify(fields) on submit. */
  name: string;
  /** Initial fields for edit mode. */
  defaultValue?: SpecField[];
}

const selectCls = 'flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function SpecFieldsBuilder({ name, defaultValue = [] }: Props) {
  const [fields, setFields] = useState<SpecField[]>(defaultValue);

  function update(i: number, patch: Partial<SpecField>) {
    setFields((fs) => fs.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }
  function add() {
    setFields((fs) => [...fs, { key: `field_${fs.length + 1}`, label: '', type: 'text' }]);
  }
  function remove(i: number) {
    setFields((fs) => fs.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(fields)} />
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
          No spec fields. Add fields like “paper weight”, “finish”, or “color” the customer must specify.
        </p>
      )}
      {fields.map((f, i) => (
        <div key={i} className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[1fr,1fr,140px,auto]">
          <div className="space-y-1">
            <Label className="text-xs">Key</Label>
            <Input value={f.key} onChange={(e) => update(i, { key: e.target.value })} placeholder="paper_weight" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input value={f.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Paper weight" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <select className={selectCls} value={f.type} onChange={(e) => update(i, { type: e.target.value as SpecField['type'] })}>
              <option value="text">text</option>
              <option value="number">number</option>
              <option value="select">select</option>
              <option value="checkbox">checkbox</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {f.type === 'select' && (
            <div className="sm:col-span-4 space-y-1">
              <Label className="text-xs">Options (comma-separated)</Label>
              <Input
                value={(f.options ?? []).join(', ')}
                onChange={(e) => update(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                placeholder="matte, gloss, uncoated"
              />
            </div>
          )}
          <div className="sm:col-span-4 flex items-center gap-2 text-xs">
            <input
              id={`req_${i}`} type="checkbox"
              checked={!!f.required}
              onChange={(e) => update(i, { required: e.target.checked })}
            />
            <label htmlFor={`req_${i}`}>Required</label>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Add spec field
      </Button>
    </div>
  );
}
