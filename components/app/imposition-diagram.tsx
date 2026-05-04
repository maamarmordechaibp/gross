'use client';
import type { ImpositionResult, PieceSize } from '@/lib/imposition';

interface Props {
  sheet: PieceSize;
  piece: PieceSize;
  result: ImpositionResult;
  margin?: number;
  gutter?: number;
}

/**
 * Visualizes a single press sheet with the imposed pieces.
 * Pure SVG, no deps. Scales to fit a 360px-wide box while preserving aspect.
 */
export function ImpositionDiagram({ sheet, piece, result, margin = 0.25, gutter = 0.125 }: Props) {
  const MAX_W = 360;
  const MAX_H = 280;
  const scale = Math.min(MAX_W / sheet.w, MAX_H / sheet.h);
  const sw = sheet.w * scale;
  const sh = sheet.h * scale;

  const pw = (result.rotated ? piece.h : piece.w) * scale;
  const ph = (result.rotated ? piece.w : piece.h) * scale;
  const m  = margin * scale;
  const g  = gutter * scale;

  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < result.rows; r++) {
    for (let c = 0; c < result.cols; c++) {
      cells.push({
        x: m + c * (pw + g),
        y: m + r * (ph + g),
      });
    }
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium">Press sheet — {sheet.w}″ × {sheet.h}″</span>
        <span className="text-muted-foreground">
          {result.cols} × {result.rows} {result.rotated ? '(rotated)' : ''} = {result.perSheet}/sheet
        </span>
      </div>
      <svg width={sw} height={sh} viewBox={`0 0 ${sw} ${sh}`} className="block">
        {/* Sheet */}
        <rect x={0} y={0} width={sw} height={sh} fill="white" stroke="hsl(var(--border))" strokeWidth={1} />
        {/* Margin guides */}
        <rect
          x={m} y={m} width={sw - 2*m} height={sh - 2*m}
          fill="none" stroke="hsl(var(--muted-foreground))"
          strokeWidth={0.5} strokeDasharray="3 3" opacity={0.6}
        />
        {/* Pieces */}
        {cells.map((c, i) => (
          <g key={i}>
            <rect
              x={c.x} y={c.y} width={pw} height={ph}
              fill="hsl(var(--primary) / 0.12)"
              stroke="hsl(var(--primary))"
              strokeWidth={1}
              rx={1}
            />
            <text
              x={c.x + pw / 2} y={c.y + ph / 2}
              textAnchor="middle" dominantBaseline="central"
              fontSize={Math.min(10, pw / 4, ph / 2)}
              fill="hsl(var(--primary))"
              fontWeight={500}
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Trim margin {margin}″ · gutter {gutter}″ · piece {piece.w}″ × {piece.h}″
        {result.rotated && ' (rotated 90°)'}
      </p>
    </div>
  );
}
