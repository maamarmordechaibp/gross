'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DynamicForm } from '@/components/forms/dynamic-form';
import { PriceBreakdownCard } from '@/components/app/price-breakdown';
import { ImpositionDiagram } from '@/components/app/imposition-diagram';
import { CustomerQuickAdd } from '@/components/app/customer-quick-add';
import { calculatePrice } from '@/lib/pricing/calculate';
import { autoPrice, type ColorMode, type Sides, type MarginTier } from '@/lib/pricing/auto-price';
import { computeImposition, parsePaperSize, PIECE_PRESETS, type PieceSize } from '@/lib/imposition';
import { formatCurrency } from '@/lib/utils';
import type { Customer, Product, PaperStock, FinishingOption } from '@/types/database';
import { createJobAction } from '../actions';
import { createQuoteFromOrderFormAction } from '../../quotes/actions';
import { toast } from 'sonner';
import { Flame } from 'lucide-react';

interface Props {
  customers: Customer[];
  products: Product[];
  papers: PaperStock[];
  finishings: FinishingOption[];
  taxRate: number;
  rushMultiplier: number;
  marginTiers: MarginTier[];
}

const DEFAULT_PRESET = 'Business card (3.5 × 2)';

/** Read piece size from a product's default_specs if present (e.g. {piece_size:{w,h}}). */
function pieceFromProduct(p: Product | undefined): PieceSize | null {
  if (!p) return null;
  const ds = p.default_specs as Record<string, unknown> | null;
  const ps = ds?.piece_size as { w?: number; h?: number } | undefined;
  if (ps && Number(ps.w) > 0 && Number(ps.h) > 0) return { w: Number(ps.w), h: Number(ps.h) };
  // Heuristic by name
  const n = p.name.toLowerCase();
  if (n.includes('business card')) return { w: 3.5, h: 2 };
  if (n.includes('postcard')) return { w: 6, h: 4 };
  if (n.includes('rack')) return { w: 9, h: 4 };
  if (n.includes('bookmark')) return { w: 7, h: 2 };
  if (n.includes('letter') || n.includes('flyer')) return { w: 11, h: 8.5 };
  return null;
}

export function OrderForm({ customers: initialCustomers, products, papers, finishings, taxRate, rushMultiplier, marginTiers }: Props) {
  const [pending, startTransition] = useTransition();
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [unitPriceTouched, setUnitPriceTouched] = useState(false);
  const [color, setColor] = useState<ColorMode>('color');
  const [sides, setSides] = useState<Sides>(1);
  const [paperId, setPaperId] = useState<string>('');
  const [paperQty, setPaperQty] = useState<number>(0);
  const [paperQtyTouched, setPaperQtyTouched] = useState(false);
  const [isRush, setIsRush] = useState(false);
  const [priority, setPriority] = useState<'low'|'normal'|'high'|'urgent'>('normal');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [specs, setSpecs] = useState<Record<string, unknown>>({});
  const [pickedFinishings, setPickedFinishings] = useState<Record<string, number>>({});

  // Imposition state
  const [pieceW, setPieceW] = useState<number>(3.5);
  const [pieceH, setPieceH] = useState<number>(2);
  const [margin, setMargin] = useState<number>(0.25);
  const [gutter, setGutter] = useState<number>(0.125);
  const [spoilagePct, setSpoilagePct] = useState<number>(5); // percent
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'rotated'>('auto');
  const [presetKey, setPresetKey] = useState<string>(DEFAULT_PRESET);

  const product = useMemo(() => products.find((p) => p.id === productId), [productId, products]);
  const paper   = useMemo(() => papers.find((p) => p.id === paperId), [paperId, papers]);
  const fields  = product?.schema?.fields ?? [];
  const sheet   = useMemo(() => parsePaperSize(paper?.size), [paper]);

  // When product changes, snap piece size to the product's hint
  useEffect(() => {
    const pp = pieceFromProduct(product);
    if (pp) {
      setPieceW(pp.w); setPieceH(pp.h);
      const match = Object.entries(PIECE_PRESETS).find(([, v]) => v.w === pp.w && v.h === pp.h);
      setPresetKey(match?.[0] ?? 'Custom');
    }
  }, [product]);

  // Auto-imposition
  const imposition = useMemo(() => {
    if (!sheet || !pieceW || !pieceH) return null;
    return computeImposition({
      piece: { w: pieceW, h: pieceH },
      sheet,
      margin,
      gutter,
      quantity: quantity || 0,
      spoilagePct: (spoilagePct || 0) / 100,
      orientation,
    });
  }, [sheet, pieceW, pieceH, margin, gutter, quantity, spoilagePct, orientation]);

  // Auto-fill paperQty unless the user has manually overridden it
  useEffect(() => {
    if (!paperQtyTouched && imposition?.fits) {
      setPaperQty(imposition.sheetsNeeded);
    }
  }, [imposition, paperQtyTouched]);

  // Auto-pricing: paper + ink + finishing × tiered markup. User can override.
  const finishingsTotalCost = useMemo(
    () => Object.entries(pickedFinishings).reduce((s, [id, qty]) => {
      const fo = finishings.find((f) => f.id === id);
      return s + (fo?.cost_per_unit ?? 0) * (qty || 0);
    }, 0),
    [pickedFinishings, finishings],
  );

  const autoPriceResult = useMemo(() => autoPrice({
    paperCostPerSheet: paper?.cost_per_sheet ?? 0,
    piecesPerSheet: imposition?.perSheet ?? 1,
    quantity: quantity || 1,
    color, sides,
    finishingsTotalCost,
    inkBw1Side:    paper?.ink_bw_1side    ?? 0,
    inkBw2Side:    paper?.ink_bw_2side    ?? 0,
    inkColor1Side: paper?.ink_color_1side ?? 0,
    inkColor2Side: paper?.ink_color_2side ?? 0,
    marginTiers,
  }), [paper, imposition, quantity, color, sides, finishingsTotalCost, marginTiers]);

  useEffect(() => {
    if (!unitPriceTouched) setUnitPrice(autoPriceResult.unitPrice);
  }, [autoPriceResult, unitPriceTouched]);

  const breakdown = useMemo(() => calculatePrice({
    paperCostPerSheet: paper?.cost_per_sheet ?? 0,
    paperQty: paperQty || 0,
    inkCost: autoPriceResult.inkPerPiece * (quantity || 0),
    finishings: Object.entries(pickedFinishings).map(([id, qty]) => {
      const fo = finishings.find((f) => f.id === id);
      return { cost_per_unit: fo?.cost_per_unit ?? 0, qty };
    }),
    unitPrice,
    quantity,
    isRush,
    rushMultiplier,
    taxRate,
  }), [paper, paperQty, autoPriceResult, pickedFinishings, finishings, unitPrice, quantity, isRush, rushMultiplier, taxRate]);

  function toggleFinishing(id: string) {
    setPickedFinishings((s) => {
      const next = { ...s };
      if (next[id] != null) delete next[id]; else next[id] = quantity;
      return next;
    });
  }

  function applyPreset(key: string) {
    setPresetKey(key);
    if (key !== 'Custom' && PIECE_PRESETS[key]) {
      setPieceW(PIECE_PRESETS[key].w);
      setPieceH(PIECE_PRESETS[key].h);
    }
  }

  function onCustomerCreated(c: Pick<Customer, 'id'|'name'|'company'|'email'|'phone'>) {
    setCustomers((cs) => [...cs, { ...c, billing_address: null, notes: null, created_at: '', updated_at: '' } as Customer]);
    setCustomerId(c.id);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      customer_id: customerId,
      product_id: productId,
      quantity, unit_price: unitPrice,
      paper_stock_id: paperId || null,
      paper_qty: paperQty || 0,
      is_rush: isRush,
      priority,
      due_date: dueDate || null,
      specs: { ...specs, piece_size: { w: pieceW, h: pieceH }, color, sides },
      notes: notes || null,
      finishings: Object.entries(pickedFinishings).map(([finishing_option_id, qty]) => ({ finishing_option_id, qty })),
    };
    const fd = new FormData();
    fd.set('payload', JSON.stringify(payload));
    startTransition(async () => {
      const res = await createJobAction(fd);
      if (res && !res.ok) toast.error(res.error ?? 'Failed to create job');
    });
  }

  function onSaveAsQuote() {
    const payload = {
      customer_id: customerId,
      product_id: productId,
      quantity, unit_price: unitPrice,
      paper_stock_id: paperId || null,
      paper_qty: paperQty || 0,
      is_rush: isRush,
      priority,
      due_date: dueDate || null,
      specs: { ...specs, piece_size: { w: pieceW, h: pieceH }, color, sides },
      notes: notes || null,
      finishings: Object.entries(pickedFinishings).map(([finishing_option_id, qty]) => ({ finishing_option_id, qty })),
    };
    const fd = new FormData();
    fd.set('payload', JSON.stringify(payload));
    startTransition(async () => {
      const res = await createQuoteFromOrderFormAction(fd);
      if (res && !res.ok) toast.error(res.error ?? 'Failed to create quote');
    });
  }

  const stockAvailable = paper ? paper.qty_on_hand - paper.qty_reserved : 0;
  const stockOk = !paper || paperQty <= stockAvailable;
  const customerRevenue = (quantity || 0) * (unitPrice || 0);
  const belowCost = breakdown.totalCost > 0 && breakdown.revenue < breakdown.totalCost;

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>Customer & Product</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer" required>
              <div className="flex gap-2">
                <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={selectCls}>
                  <option value="">Select customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
                </select>
                <CustomerQuickAdd onCreated={onCustomerCreated} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Not in the list? Click <strong>+ New</strong> to add instantly.</p>
            </Field>
            <Field label="Product" required>
              <select required value={productId} onChange={(e) => { setProductId(e.target.value); setSpecs({}); }} className={selectCls}>
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Quantity" required>
              <Input type="number" min={1} required value={quantity} onChange={(e) => setQuantity(e.target.valueAsNumber || 0)} />
              <p className="mt-1 text-xs text-muted-foreground">Number of finished pieces the customer is ordering.</p>
            </Field>
            <Field label="Unit price (USD)">
              <div className="flex gap-2">
                <Input
                  type="number" step="0.01" min={0} value={unitPrice}
                  onChange={(e) => { setUnitPrice(e.target.valueAsNumber || 0); setUnitPriceTouched(true); }}
                  className={unitPriceTouched ? '' : 'bg-emerald-50 dark:bg-emerald-950/20'}
                />
                {unitPriceTouched && (
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => { setUnitPriceTouched(false); setUnitPrice(autoPriceResult.unitPrice); }}>
                    Auto
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {unitPriceTouched
                  ? <>Manual override. Subtotal: <strong className="tabular text-foreground">{formatCurrency(customerRevenue)}</strong></>
                  : <>Blended auto-price across volume tiers. Subtotal: <strong className="tabular text-foreground">{formatCurrency(customerRevenue)}</strong></>
                }
              </p>
            </Field>
            <Field label="Color mode">
              <select value={color} onChange={(e) => setColor(e.target.value as ColorMode)} className={selectCls}>
                <option value="color">Full color</option>
                <option value="bw">Black &amp; white</option>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Affects ink/click charge in auto-price.</p>
            </Field>
            <Field label="Sides">
              <select value={sides} onChange={(e) => setSides(Number(e.target.value) as Sides)} className={selectCls}>
                <option value={1}>Single sided</option>
                <option value={2}>Double sided</option>
              </select>
            </Field>
          </CardContent>
        </Card>

        {!unitPriceTouched && (
          <div className="-mt-2 rounded-lg border bg-muted/30 p-3 text-xs">
            <div className="mb-1 font-semibold uppercase tracking-wider text-muted-foreground">Auto-price breakdown (per piece)</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-4">
              <span>Paper</span><span className="text-right tabular">{formatCurrency(autoPriceResult.paperPerPiece)}</span>
              <span>Ink ({sides} side{sides > 1 ? 's' : ''}, {color === 'color' ? 'color' : 'B&W'})</span><span className="text-right tabular">{formatCurrency(autoPriceResult.inkPerPiece)}</span>
              <span>Finishing</span><span className="text-right tabular">{formatCurrency(autoPriceResult.finishingPerPiece)}</span>
              <span className="font-medium">Cost / piece</span><span className="text-right font-medium tabular">{formatCurrency(autoPriceResult.costPerPiece)}</span>
            </div>
            {autoPriceResult.tierLines.length > 0 && (
              <>
                <div className="mt-2 border-t pt-2 font-semibold uppercase tracking-wider text-muted-foreground">Volume pricing</div>
                <div className="mt-1 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5">
                  {autoPriceResult.tierLines.map((t, i) => (
                    <div key={i} className="contents">
                      <span>Pieces {t.fromQty}–{t.toQty} ({t.units})</span>
                      <span className="text-right tabular">{Math.round(t.marginPct * 100)}%</span>
                      <span className="text-right tabular">{formatCurrency(t.unitPrice)}/pc</span>
                    </div>
                  ))}
                  <span className="border-t pt-1 font-semibold text-foreground">Blended unit price</span>
                  <span className="border-t pt-1"></span>
                  <span className="border-t pt-1 text-right font-semibold tabular text-foreground">{formatCurrency(autoPriceResult.unitPrice)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {product && fields.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
            <CardContent>
              <DynamicForm fields={fields} values={specs} onChange={setSpecs} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Piece size & paper</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Finished piece preset">
                <select value={presetKey} onChange={(e) => applyPreset(e.target.value)} className={selectCls}>
                  {Object.keys(PIECE_PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
                  <option value="Custom">Custom…</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Width (in)">
                  <Input type="number" step="0.0625" min={0} value={pieceW}
                    onChange={(e) => { setPieceW(e.target.valueAsNumber || 0); setPresetKey('Custom'); }} />
                </Field>
                <Field label="Height (in)">
                  <Input type="number" step="0.0625" min={0} value={pieceH}
                    onChange={(e) => { setPieceH(e.target.valueAsNumber || 0); setPresetKey('Custom'); }} />
                </Field>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Paper stock">
                <select value={paperId} onChange={(e) => { setPaperId(e.target.value); setPaperQtyTouched(false); }} className={selectCls}>
                  <option value="">No paper</option>
                  {papers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.size}) — {p.qty_on_hand - p.qty_reserved} avail
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sheets needed">
                <Input
                  type="number" min={0} value={paperQty}
                  onChange={(e) => { setPaperQty(e.target.valueAsNumber || 0); setPaperQtyTouched(true); }}
                />
                {paper && (
                  <p className={`mt-1 text-xs ${stockOk ? 'text-muted-foreground' : 'text-destructive font-medium'}`}>
                    Available: {stockAvailable} sheets {stockOk ? '' : '— insufficient stock'}
                    {paperQtyTouched && imposition?.fits && (
                      <button type="button" className="ml-2 underline"
                        onClick={() => { setPaperQty(imposition.sheetsNeeded); setPaperQtyTouched(false); }}>
                        Recalculate
                      </button>
                    )}
                  </p>
                )}
              </Field>
            </div>

            {sheet && imposition && (
              <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
                <ImpositionDiagram
                  sheet={sheet}
                  piece={{ w: pieceW, h: pieceH }}
                  result={imposition}
                  margin={margin}
                  gutter={gutter}
                />
                <div className="space-y-3 text-sm">
                  {imposition.fits ? (
                    <>
                      <div className="rounded-lg border bg-card p-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-muted-foreground">Pieces per sheet</span>
                          <span className="text-2xl font-semibold tabular">{imposition.perSheet}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {imposition.cols} across × {imposition.rows} down{imposition.rotated ? ' (rotated 90°)' : ''}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-card p-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-muted-foreground">Sheets needed</span>
                          <span className="text-2xl font-semibold tabular">{imposition.sheetsNeeded}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {imposition.sheetsRaw} for the run + {imposition.spoilageSheets} spoilage ({spoilagePct}%)
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                      <p className="font-medium">Piece doesn’t fit on this sheet</p>
                      <p className="text-xs">Reduce piece size, margin/gutter, or pick a larger paper.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Margin (in)">
                      <Input type="number" step="0.0625" min={0} value={margin} onChange={(e) => setMargin(e.target.valueAsNumber || 0)} />
                    </Field>
                    <Field label="Gutter (in)">
                      <Input type="number" step="0.0625" min={0} value={gutter} onChange={(e) => setGutter(e.target.valueAsNumber || 0)} />
                    </Field>
                    <Field label="Spoilage %">
                      <Input type="number" step="1" min={0} value={spoilagePct} onChange={(e) => setSpoilagePct(e.target.valueAsNumber || 0)} />
                    </Field>
                  </div>
                  <Field label="Orientation">
                    <select value={orientation} onChange={(e) => setOrientation(e.target.value as never)} className={selectCls}>
                      <option value="auto">Auto (best yield)</option>
                      <option value="portrait">As entered</option>
                      <option value="rotated">Rotated 90°</option>
                    </select>
                  </Field>
                </div>
              </div>
            )}
            {!sheet && paper && (
              <p className="text-xs text-muted-foreground">
                Paper size <strong>{paper.size}</strong> couldn’t be parsed (expected like <code>12x18</code>).
                Update it in inventory to enable auto-calculation.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Finishing</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {finishings.map((f) => {
                const active = pickedFinishings[f.id] != null;
                return (
                  <button
                    type="button" key={f.id}
                    onClick={() => toggleFinishing(f.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      active ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{f.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{f.type}</div>
                    </div>
                    <div className="text-xs tabular text-muted-foreground">${f.cost_per_unit.toFixed(2)}/u</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Schedule & Priority</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Due date">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as never)} className={selectCls}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
            <label className="col-span-full flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
              <input type="checkbox" checked={isRush} onChange={(e) => setIsRush(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--destructive))]" />
              <Flame className={`h-4 w-4 ${isRush ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div className="flex-1 text-sm">
                <div className="font-medium">Rush job</div>
                <div className="text-xs text-muted-foreground">Adds {Math.round(rushMultiplier * 100)}% surcharge</div>
              </div>
            </label>
            <Field label="Customer notes" className="col-span-full">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
        <PriceBreakdownCard breakdown={breakdown} />
        <Button type="submit" className="w-full" size="lg" disabled={pending || !customerId || !productId || !stockOk || belowCost}>
          {pending ? 'Creating…' : 'Create Order'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          size="lg"
          onClick={onSaveAsQuote}
          disabled={pending || !customerId || !productId || belowCost}
        >
          {pending ? 'Saving…' : 'Save as Quote'}
        </Button>
        {!stockOk && <p className="text-center text-xs text-destructive">Resolve stock to proceed</p>}
        {belowCost && (
          <p className="text-center text-xs text-destructive">
            Price is below cost (loss of ${(breakdown.totalCost - breakdown.revenue).toFixed(2)}). Raise the unit price to proceed.
          </p>
        )}
      </div>
    </form>
  );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

const selectCls = 'flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
