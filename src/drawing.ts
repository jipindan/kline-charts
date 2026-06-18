import { Candle, OhlcField } from './types';
import { ChartLayout, dayKey } from './renderer';

export interface SnapPoint {
  candleIdx: number;
  field: OhlcField;
  price: number;
}

const OHLC_FIELDS: OhlcField[] = ['open', 'high', 'low', 'close'];

export function snapToCandle(
  mx: number,
  my: number,
  candles: Candle[],
  layout: ChartLayout,
): SnapPoint | null {
  const idx = Math.round((mx - 8) / layout.slotW - 0.5);
  if (idx < 0 || idx >= candles.length) return null;

  const c = candles[idx];
  let bestField: OhlcField = 'close';
  let bestDist = Infinity;

  for (const f of OHLC_FIELDS) {
    const py = layout.toY(c[f]);
    const dist = Math.abs(my - py);
    if (dist < bestDist) {
      bestDist = dist;
      bestField = f;
    }
  }

  return { candleIdx: idx, field: bestField, price: candles[idx][bestField] };
}

export function formatDrawnAnnotation(
  start: SnapPoint,
  end: SnapPoint,
  candles: Candle[],
  extend = false,
): string {
  const d1 = dayKey(candles[start.candleIdx].time);
  const d2 = dayKey(candles[end.candleIdx].time);
  const base = `  - type: trendline\n    from: [${d1}, ${start.field}]\n    to: [${d2}, ${end.field}]`;
  return extend ? base + '\n    extend: true' : base;
}

export function extendLineToChart(
  x1: number, y1: number,
  x2: number, y2: number,
  xLeft: number, xRight: number,
): { x1: number; y1: number; x2: number; y2: number } {
  if (Math.abs(x2 - x1) < 0.001) return { x1, y1, x2, y2 };
  const slope = (y2 - y1) / (x2 - x1);
  return {
    x1: xLeft,  y1: y1 + slope * (xLeft  - x1),
    x2: xRight, y2: y1 + slope * (xRight - x1),
  };
}

export interface DrawingState {
  active: boolean;
  start: SnapPoint | null;
}

export function drawPreviewLine(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  start: SnapPoint,
  endX: number,
  endY: number,
  layout: ChartLayout,
  extend = false,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(dpr, dpr);

  const x1 = layout.toX(start.candleIdx);
  const y1 = layout.toY(start.price);
  const xLeft  = 8;
  const xRight = 8 + layout.chartW;

  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  if (extend && Math.abs(endX - x1) > 0.001) {
    const ext = extendLineToChart(x1, y1, endX, endY, xLeft, xRight);
    ctx.moveTo(ext.x1, ext.y1);
    ctx.lineTo(ext.x2, ext.y2);
  } else {
    ctx.moveTo(x1, y1);
    ctx.lineTo(endX, endY);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.arc(x1, y1, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(endX, endY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
