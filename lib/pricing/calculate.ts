/**
 * Cost / profit engine for a single job.
 *
 * Costs are real expenses only: paper + ink (computed by caller and passed in
 * as `inkCost`) + finishing. The product's `base_price` is no longer treated
 * as labor — it's a UI-side starting price suggestion only.
 *
 * Rush is a customer surcharge — added to revenue, not cost.
 */

export interface FinishingLine {
  cost_per_unit: number;
  qty: number;
}

export interface PriceInputs {
  paperCostPerSheet: number;
  paperQty: number;
  /** Total ink cost for the whole run (per-piece × quantity). */
  inkCost?: number;
  finishings: FinishingLine[];
  unitPrice: number;
  quantity: number;
  isRush: boolean;
  rushMultiplier?: number;    // default 0.25
  taxRate?: number;           // default 0
}

export interface PriceBreakdown {
  paperCost: number;
  inkCost: number;
  finishingCost: number;
  rushSurcharge: number;
  totalCost: number;
  revenue: number;
  tax: number;
  grandTotal: number;
  profit: number;
  marginPct: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function calculatePrice(input: PriceInputs): PriceBreakdown {
  const rushMult = input.rushMultiplier ?? 0.25;
  const taxRate = input.taxRate ?? 0;

  const paperCost     = round(input.paperCostPerSheet * input.paperQty);
  const inkCost       = round(input.inkCost ?? 0);
  const finishingCost = round(input.finishings.reduce((s, f) => s + f.cost_per_unit * f.qty, 0));

  // Rush is a customer surcharge (revenue), not an internal cost.
  const totalCost     = round(paperCost + inkCost + finishingCost);
  const baseRevenue   = round(input.unitPrice * input.quantity);
  const rushSurcharge = input.isRush ? round(baseRevenue * rushMult) : 0;
  const revenue       = round(baseRevenue + rushSurcharge);
  const tax           = round(revenue * taxRate);
  const grandTotal    = round(revenue + tax);
  const profit        = round(revenue - totalCost);
  const marginPct     = revenue > 0 ? round((profit / revenue) * 100) : 0;

  return { paperCost, inkCost, finishingCost, rushSurcharge, totalCost,
    revenue, tax, grandTotal, profit, marginPct };
}
