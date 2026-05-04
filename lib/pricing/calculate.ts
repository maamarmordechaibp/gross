/**
 * Cost / profit engine — mirrors the SQL trigger in 0001_init.sql.
 * Used for live preview while a job is being created or edited.
 */

export interface FinishingLine {
  cost_per_unit: number;
  qty: number;
}

export interface PriceInputs {
  paperCostPerSheet: number;
  paperQty: number;
  finishings: FinishingLine[];
  productBasePrice: number;   // labor / setup baseline
  unitPrice: number;
  quantity: number;
  isRush: boolean;
  rushMultiplier?: number;    // default 0.25
  taxRate?: number;           // default 0
}

export interface PriceBreakdown {
  paperCost: number;
  finishingCost: number;
  laborCost: number;
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
  const finishingCost = round(input.finishings.reduce((s, f) => s + f.cost_per_unit * f.qty, 0));
  const laborCost     = round(input.productBasePrice);

  // Rush is a customer surcharge (revenue), not an internal cost.
  const totalCost     = round(paperCost + finishingCost + laborCost);
  const baseRevenue   = round(input.unitPrice * input.quantity);
  const rushSurcharge = input.isRush ? round(baseRevenue * rushMult) : 0;
  const revenue       = round(baseRevenue + rushSurcharge);
  const tax           = round(revenue * taxRate);
  const grandTotal    = round(revenue + tax);
  const profit        = round(revenue - totalCost);
  const marginPct     = revenue > 0 ? round((profit / revenue) * 100) : 0;

  return { paperCost, finishingCost, laborCost, rushSurcharge, totalCost,
    revenue, tax, grandTotal, profit, marginPct };
}
