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
): string {
  const d1 = dayKey(candles[start.candleIdx].time);
  const d2 = dayKey(candles[end.candleIdx].time);
  return `  - type: trendline\n    from: [${d1}, ${start.field}]\n    to: [${d2}, ${end.field}]`;
}

export interface DrawingState {
  active: boolean;
  start: SnapPoint | null;
}

export function drawPreviewLine(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  start: SnapPoint,
  mx: number,
  my: number,
  layout: ChartLayout,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(dpr, dpr);

  const x1 = layout.toX(start.candleIdx);
  const y1 = layout.toY(start.price);

  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(mx, my);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.arc(x1, y1, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
