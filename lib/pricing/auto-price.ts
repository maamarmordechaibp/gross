/**
 * Auto-pricing engine.
 *
 * Computes a customer-facing unit price (USD per finished piece) from:
 *   - paper cost per sheet
 *   - imposition (pieces per sheet)
 *   - color / B&W
 *   - single / double sided
 *   - finishing total
 *   - quantity (drives volume tier markup)
 *
 * The output is the recommended price-per-piece. The user can still override.
 */

export type ColorMode = 'color' | 'bw';
export type Sides = 1 | 2;

export interface AutoPriceInput {
  /** Paper cost per sheet (USD). 0 if no paper picked. */
  paperCostPerSheet: number;
  /** Pieces fitting on one sheet from imposition. Defaults to 1 if unknown. */
  piecesPerSheet: number;
  /** Total finished pieces being ordered. */
  quantity: number;
  /** Color or black & white. */
  color: ColorMode;
  /** 1 = single sided, 2 = double sided. */
  sides: Sides;
  /** Sum of (cost_per_unit × qty) for selected finishings. */
  finishingsTotalCost: number;
}

export interface AutoPriceResult {
  unitPrice: number;
  costPerPiece: number;
  paperPerPiece: number;
  inkPerPiece: number;
  finishingPerPiece: number;
  markupMultiplier: number;
  tier: string;
  minPerPiece: number;
}

/**
 * Click charge per side (USD). Captures toner/ink + maintenance amortization.
 * Tweak in settings later — these are good starting defaults for digital.
 */
const INK_COLOR_PER_SIDE = 0.08;
const INK_BW_PER_SIDE = 0.015;

/**
 * Volume tiers — smaller orders carry a bigger markup multiplier and a higher
 * minimum per-piece floor. This mirrors how most print shops actually quote.
 */
const TIERS: Array<{ upTo: number; mult: number; floor: number; label: string }> = [
  { upTo: 49,    mult: 5.0,  floor: 0.75, label: '1–49 (setup heavy)' },
  { upTo: 99,    mult: 4.0,  floor: 0.60, label: '50–99' },
  { upTo: 249,   mult: 3.0,  floor: 0.45, label: '100–249' },
  { upTo: 499,   mult: 2.5,  floor: 0.30, label: '250–499' },
  { upTo: 999,   mult: 2.2,  floor: 0.20, label: '500–999' },
  { upTo: 2499,  mult: 2.0,  floor: 0.12, label: '1,000–2,499' },
  { upTo: 4999,  mult: 1.85, floor: 0.08, label: '2,500–4,999' },
  { upTo: Infinity, mult: 1.75, floor: 0.05, label: '5,000+' },
];

function pickTier(qty: number) {
  return TIERS.find((t) => qty <= t.upTo) ?? TIERS[TIERS.length - 1];
}

/** Round UP to the nearest $0.05 to keep prices clean. */
function roundUpNickel(n: number): number {
  return Math.ceil(n * 20) / 20;
}

export function autoPrice(input: AutoPriceInput): AutoPriceResult {
  const qty = Math.max(1, input.quantity || 1);
  const pps = Math.max(1, input.piecesPerSheet || 1);

  const paperPerPiece = (input.paperCostPerSheet || 0) / pps;
  const inkPerSide = input.color === 'color' ? INK_COLOR_PER_SIDE : INK_BW_PER_SIDE;
  const inkPerPiece = inkPerSide * (input.sides === 2 ? 2 : 1);
  const finishingPerPiece = (input.finishingsTotalCost || 0) / qty;

  const costPerPiece = paperPerPiece + inkPerPiece + finishingPerPiece;
  const tier = pickTier(qty);

  const raw = Math.max(costPerPiece * tier.mult, tier.floor);
  const unitPrice = roundUpNickel(raw);

  return {
    unitPrice,
    costPerPiece,
    paperPerPiece,
    inkPerPiece,
    finishingPerPiece,
    markupMultiplier: tier.mult,
    tier: tier.label,
    minPerPiece: tier.floor,
  };
}
