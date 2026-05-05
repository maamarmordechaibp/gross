'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

export interface MarginTierRow {
  min_qty: number;
  margin_pct: number; // decimal
}

interface Props {
  initial: MarginTierRow[];
  /** Hidden field name; the JSON of tiers is posted here. */
  name?: string;
}

export function MarginTiersEditor({ initial, name = 'margin_tiers' }: Props) {
  const seed = (initial && initial.length > 0)
    ? [...initial].sort((a, b) => a.min_qty - b.min_qty)
    : [{ min_qty: 0, margin_pct: 1.0 }];
  const [rows, setRows] = useState<MarginTierRow[]>(seed);

  function update(i: number, patch: Partial<MarginTierRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    const last = rows[rows.length - 1];
    setRows([...rows, { min_qty: (last?.min_qty ?? 0) + 100, margin_pct: Math.max(0, (last?.margin_pct ?? 0.5) - 0.1) }]);
  }
  function remove(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  const sorted = [...rows].sort((a, b) => a.min_qty - b.min_qty);

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(sorted)} />

      <div className="rounded-lg border">
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>From qty (min)</span>
          <span>Margin (% over cost)</span>
          <span></span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b px-3 py-2 last:border-b-0">
            <Input
              type="number" min={0} step={1} value={r.min_qty}
              onChange={(e) => update(i, { min_qty: Number(e.target.value) || 0 })}
            />
            <div className="flex items-center gap-2">
              <Input
                type="number" min={0} step={1} value={Math.round(r.margin_pct * 100)}
                onChange={(e) => update(i, { margin_pct: (Number(e.target.value) || 0) / 100 })}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} disabled={rows.length === 1}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Add tier
      </Button>

      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <div className="mb-1 font-medium text-foreground">Preview at $0.15/piece cost:</div>
        {sorted.map((t, i) => {
          const next = sorted[i + 1]?.min_qty;
          const range = next ? `${t.min_qty + 1}–${next}` : `${t.min_qty + 1}+`;
          const price = (0.15 * (1 + t.margin_pct)).toFixed(3);
          return (
            <div key={i} className="flex justify-between tabular">
              <span>Pieces {range}</span>
              <span>{Math.round(t.margin_pct * 100)}% → ${price}/pc</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
