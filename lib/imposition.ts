/**
 * Imposition / paper math.
 * All dimensions are inches.
 *
 * Given a finished piece size and a parent sheet size, compute how many
 * pieces fit per sheet (best of two orientations) and how many sheets
 * are needed for a target quantity, plus a layout grid for diagrams.
 */

export interface PieceSize {
  /** width inches */
  w: number;
  /** height inches */
  h: number;
}

/** Common product presets (US). */
export const PIECE_PRESETS: Record<string, PieceSize> = {
  'Business card (3.5 × 2)':   { w: 3.5, h: 2     },
  'Postcard (4 × 6)':          { w: 6,   h: 4     },
  'Postcard (5 × 7)':          { w: 7,   h: 5     },
  'Rack card (4 × 9)':         { w: 9,   h: 4     },
  'Half-letter (5.5 × 8.5)':   { w: 8.5, h: 5.5   },
  'Letter (8.5 × 11)':         { w: 11,  h: 8.5   },
  'Tabloid (11 × 17)':         { w: 17,  h: 11    },
  'Bookmark (2 × 7)':          { w: 7,   h: 2     },
  'Door hanger (4.25 × 11)':   { w: 11,  h: 4.25  },
  'Brochure tri-fold (8.5 × 11)': { w: 11, h: 8.5 },
};

/**
 * Parse strings like "12x18", "12 x 18", "8.5x11", "13 × 19".
 * Returns null if the string can't be parsed.
 */
export function parsePaperSize(size: string | null | undefined): PieceSize | null {
  if (!size) return null;
  const m = size.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return null;
  return { w, h };
}

export interface ImpositionInput {
  /** Finished piece size (after trim). */
  piece: PieceSize;
  /** Parent sheet size (paper as purchased / loaded into press). */
  sheet: PieceSize;
  /** Trim margin around the imposed block, all sides (inches). Default 0.25. */
  margin?: number;
  /** Gutter between pieces (inches). Default 0.125. */
  gutter?: number;
  /** Target finished quantity. */
  quantity: number;
  /** Spoilage / make-ready percent. Default 0.05 (5%). */
  spoilagePct?: number;
  /** Force orientation. 'auto' picks the higher-yield orientation. */
  orientation?: 'auto' | 'portrait' | 'rotated';
}

export interface ImpositionResult {
  /** Pieces per sheet (cols × rows). */
  perSheet: number;
  cols: number;
  rows: number;
  /** Whether the piece was rotated 90° relative to its input dimensions. */
  rotated: boolean;
  /** Sheets needed for the quantity, including spoilage. */
  sheetsNeeded: number;
  /** Sheets BEFORE adding spoilage (purely mathematical). */
  sheetsRaw: number;
  /** Spoilage sheets added. */
  spoilageSheets: number;
  /** Effective imposable area (sheet minus 2× margin). */
  area: PieceSize;
  /** Per-piece footprint including gutter (used for layout). */
  cell: PieceSize;
  /** Whether the piece simply doesn't fit on the sheet at any orientation. */
  fits: boolean;
}

function fitOne(piece: PieceSize, sheet: PieceSize, margin: number, gutter: number) {
  const aw = sheet.w - 2 * margin;
  const ah = sheet.h - 2 * margin;
  if (aw <= 0 || ah <= 0 || piece.w <= 0 || piece.h <= 0) {
    return { cols: 0, rows: 0, perSheet: 0 };
  }
  // n cells fit if n*piece + (n-1)*gutter <= area  =>  n <= (area+gutter) / (piece+gutter)
  const cols = Math.max(0, Math.floor((aw + gutter) / (piece.w + gutter)));
  const rows = Math.max(0, Math.floor((ah + gutter) / (piece.h + gutter)));
  return { cols, rows, perSheet: cols * rows };
}

export function computeImposition(input: ImpositionInput): ImpositionResult {
  const margin = input.margin ?? 0.25;
  const gutter = input.gutter ?? 0.125;
  const spoilagePct = input.spoilagePct ?? 0.05;

  const a = fitOne(input.piece, input.sheet, margin, gutter);
  const b = fitOne({ w: input.piece.h, h: input.piece.w }, input.sheet, margin, gutter);

  let chosen: { cols: number; rows: number; perSheet: number };
  let rotated: boolean;
  if (input.orientation === 'portrait') { chosen = a; rotated = false; }
  else if (input.orientation === 'rotated') { chosen = b; rotated = true; }
  else if (b.perSheet > a.perSheet) { chosen = b; rotated = true; }
  else { chosen = a; rotated = false; }

  const piece = rotated ? { w: input.piece.h, h: input.piece.w } : input.piece;
  const fits = chosen.perSheet > 0;

  const sheetsRaw = fits ? Math.ceil(input.quantity / chosen.perSheet) : 0;
  const spoilageSheets = fits ? Math.ceil(sheetsRaw * spoilagePct) : 0;
  const sheetsNeeded = sheetsRaw + spoilageSheets;

  return {
    perSheet: chosen.perSheet,
    cols: chosen.cols,
    rows: chosen.rows,
    rotated,
    sheetsNeeded,
    sheetsRaw,
    spoilageSheets,
    area: { w: input.sheet.w - 2 * margin, h: input.sheet.h - 2 * margin },
    cell: { w: piece.w + gutter, h: piece.h + gutter },
    fits,
  };
}
