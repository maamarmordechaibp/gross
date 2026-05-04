/**
 * Auto-pricing engine.
 *
 * Customer-facing unit price (USD per finished piece) =
 *     (paper + ink + finishing) per piece × (1 + margin)
 *
 * Per-paper ink rates and the default margin are stored in the DB
 * (paper_stocks.bw_ink_per_side / color_ink_per_side, settings.default_margin_pct).
 */

export type ColorMode = 'color' | 'bw';
export type Sides = 1 | 2;

export interface AutoPriceInput {
  paperCostPerSheet: number;
  piecesPerSheet: number;
  quantity: number;
  color: ColorMode;
  sides: Sides;
  finishingsTotalCost: number;
  bwInkPerSide: number;
  colorInkPerSide: number;
  /** e.g. 1.00 = +100% (2x cost), 0.5 = +50% */
  marginPct: number;
}

export interface AutoPriceResult {
  unitPrice: number;
  costPerPiece: number;
  paperPerPiece: number;
  inkPerPiece: number;
  finishingPerPiece: number;
  marginPct: number;
}

function roundUpCent(n: number): number {
  return Math.ceil(n * 100) / 100;
}

export function autoPrice(input: AutoPriceInput): AutoPriceResult {
  const qty = Math.max(1, input.quantity || 1);
  const pps = Math.max(1, input.piecesPerSheet || 1);

  const paperPerPiece = (input.paperCostPerSheet || 0) / pps;
  const inkPerSide = input.color === 'color'
    ? (input.colorInkPerSide || 0)
    : (input.bwInkPerSide || 0);
  const inkPerPiece = inkPerSide * (input.sides === 2 ? 2 : 1);
  const finishingPerPiece = (input.finishingsTotalCost || 0) / qty;

  const costPerPiece = paperPerPiece + inkPerPiece + finishingPerPiece;
  const margin = Math.max(0, input.marginPct || 0);
  const unitPrice = roundUpCent(costPerPiece * (1 + margin));

  return {
    unitPrice,
    costPerPiece,
    paperPerPiece,
    inkPerPiece,
    finishingPerPiece,
    marginPct: margin,
  };
}
