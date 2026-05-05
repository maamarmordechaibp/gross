/**
 * Auto-pricing engine — tiered (volume-discount) margin.
 *
 * Cost per piece = paper + ink + finishing.
 * Revenue per piece is computed by walking the order quantity through
 * `marginTiers` (sorted by min_qty asc) and applying each tier's margin to
 * the units that fall within it.
 *
 * Example tiers: [{0,1.0},{100,0.6},{500,0.4}]
 *   - units 1..100   priced at cost × 2.00
 *   - units 101..500 priced at cost × 1.60
 *   - units 501+     priced at cost × 1.40
 *
 * `unitPrice` returned is the *blended* average (revenueTotal / quantity),
 * rounded up to the cent — convenient for storing on a job row.
 */

export type ColorMode = 'color' | 'bw';
export type Sides = 1 | 2;

export interface MarginTier {
  min_qty: number;
  margin_pct: number; // decimal: 1.0 = +100%
}

export interface AutoPriceInput {
  paperCostPerSheet: number;
  piecesPerSheet: number;
  quantity: number;
  color: ColorMode;
  sides: Sides;
  finishingsTotalCost: number;
  /** Per-piece ink rates split by (color × sides). */
  inkBw1Side: number;
  inkBw2Side: number;
  inkColor1Side: number;
  inkColor2Side: number;
  /** Volume-tier margins (decimals). Empty → flat 0%. */
  marginTiers: MarginTier[];
}

export interface AutoPriceTierLine {
  fromQty: number;   // 1-based start
  toQty: number;     // inclusive end
  units: number;
  marginPct: number; // decimal
  unitPrice: number; // per-piece (rounded up to cent)
  lineRevenue: number;
}

export interface AutoPriceResult {
  unitPrice: number;     // blended average, rounded up to cent
  costPerPiece: number;
  paperPerPiece: number;
  inkPerPiece: number;
  finishingPerPiece: number;
  revenueTotal: number;
  tierLines: AutoPriceTierLine[];
}

function roundUpCent(n: number): number {
  return Math.ceil(n * 100) / 100;
}

function pickInkRate(input: AutoPriceInput): number {
  if (input.color === 'color') {
    return input.sides === 2 ? (input.inkColor2Side || 0) : (input.inkColor1Side || 0);
  }
  return input.sides === 2 ? (input.inkBw2Side || 0) : (input.inkBw1Side || 0);
}

export function autoPrice(input: AutoPriceInput): AutoPriceResult {
  const qty = Math.max(1, Math.floor(input.quantity || 1));
  const pps = Math.max(1, input.piecesPerSheet || 1);

  const paperPerPiece = (input.paperCostPerSheet || 0) / pps;
  const inkPerPiece = pickInkRate(input);
  const finishingPerPiece = (input.finishingsTotalCost || 0) / qty;
  const costPerPiece = paperPerPiece + inkPerPiece + finishingPerPiece;

  // Sort tiers ascending; ensure tier covering qty 1+.
  const tiers = [...(input.marginTiers ?? [])]
    .filter((t) => Number.isFinite(t.min_qty) && Number.isFinite(t.margin_pct))
    .sort((a, b) => a.min_qty - b.min_qty);
  if (tiers.length === 0 || tiers[0].min_qty > 0) tiers.unshift({ min_qty: 0, margin_pct: 0 });

  const tierLines: AutoPriceTierLine[] = [];
  let revenueTotal = 0;

  for (let i = 0; i < tiers.length; i++) {
    const start = Math.max(1, tiers[i].min_qty + 1);
    const next = tiers[i + 1]?.min_qty ?? Infinity;
    const end = Math.min(qty, next);
    if (start > qty) break;
    const units = end - start + 1;
    if (units <= 0) continue;
    const margin = Math.max(0, tiers[i].margin_pct);
    const unitPrice = roundUpCent(costPerPiece * (1 + margin));
    const lineRevenue = +(unitPrice * units).toFixed(2);
    revenueTotal += lineRevenue;
    tierLines.push({ fromQty: start, toQty: end, units, marginPct: margin, unitPrice, lineRevenue });
  }

  const blended = qty > 0 ? roundUpCent(revenueTotal / qty) : 0;
  return {
    unitPrice: blended,
    costPerPiece,
    paperPerPiece,
    inkPerPiece,
    finishingPerPiece,
    revenueTotal: +revenueTotal.toFixed(2),
    tierLines,
  };
}
