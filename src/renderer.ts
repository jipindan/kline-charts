import { Candle, KlineConfig, Annotation, OhlcField } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────

function isDarkTheme(): boolean {
  return document.body.classList.contains('theme-dark');
}

function getColors(dark: boolean) {
  return {
    text:     dark ? '#9ca3af' : '#6b7280',
    grid:     dark ? '#2d3748' : '#e5e7eb',
    up:       '#26a69a',
    down:     '#ef5350',
    upVol:    '#26a69a4d',
    downVol:  '#ef53504d',
    entry:    '#f59e0b',
    trend:    '#60a5fa',      // clean blue
    posTP:    '#26a69a20',   // TP box fill (green, very translucent)
    posSL:    '#ef535020',   // SL box fill (red, very translucent)
    posTPTxt: '#26a69aCC',
    posSLTxt: '#ef5350CC',
  };
}

function fmtPrice(price: number): string {
  if (price >= 10000) return price.toFixed(0);
  if (price >= 100)   return price.toFixed(1);
  if (price >= 1)     return price.toFixed(2);
  if (price >= 0.01)  return price.toFixed(4);
  return price.toFixed(6);
}

function fmtDate(unix: number, intraday: boolean): string {
  const d  = new Date(unix * 1000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  if (!intraday) return `${mm}/${dd}`;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mn = String(d.getUTCMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mn}`;
}

/** "2024-01-15" → UTC day key string for matching annotation dates to candles */
function dayKey(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// ── Error / no-data states ────────────────────────────────────────────────

export function renderError(container: HTMLElement, message: string): void {
  container.empty();
  container.createDiv({ cls: 'kline-error', text: `⚠ ${message}` });
}

export function renderNoData(container: HTMLElement, config: KlineConfig): void {
  container.empty();
  const el = container.createDiv({ cls: 'kline-fetch-container' });
  const parts = [config.symbol, config.interval ?? '1d'];
  if (config.from) parts.push(`${config.from} → ${config.to ?? '?'}`);
  el.createDiv({ cls: 'kline-fetch-meta', text: parts.join(' · ') });
  el.createDiv({ cls: 'kline-fetch-meta', text: 'No data — Fetch will be available soon' });
}

// ── Canvas chart renderer ─────────────────────────────────────────────────

const PAD        = { top: 20, right: 72, bottom: 36, left: 8 };
const TOTAL_H    = 380;
const VOL_RATIO  = 0.2;
const VOL_GAP    = 6;
const FONT       = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_BOLD  = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const GRID_LINES = 5;
const MAX_BODY_W = 14;

// ── Annotation drawing ────────────────────────────────────────────────────

function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  candles: Candle[],
  toX: (i: number) => number,
  toY: (price: number) => number,
  slotW: number,
  chartW: number,
  col: ReturnType<typeof getColors>,
) {
  // Build date string → candle index map (UTC)
  const dateMap = new Map<string, number>();
  candles.forEach((c, i) => dateMap.set(dayKey(c.time), i));

  for (const ann of annotations) {

    // ── Position (TP/SL boxes) ─────────────────────────────────────
    if (ann.type === 'position') {
      const i1 = dateMap.get(ann.entry_date);
      const i2 = dateMap.get(ann.exit_date);
      if (i1 === undefined || i2 === undefined) continue;

      // X coords: candle center (wick) of entry → candle center of exit
      const xLeft  = toX(i1);
      const xRight = toX(i2);
      const boxW   = xRight - xLeft;

      const yEntry = toY(ann.entry);
      const yTP    = toY(ann.tp);
      const ySL    = toY(ann.sl);

      // TP box (entry → tp, green, no border)
      ctx.fillStyle = col.posTP;
      ctx.fillRect(xLeft, yTP, boxW, yEntry - yTP);

      // SL box (entry → sl, red, no border)
      ctx.fillStyle = col.posSL;
      ctx.fillRect(xLeft, yEntry, boxW, ySL - yEntry);

      // Labels
      ctx.font         = FONT;
      ctx.textBaseline = 'bottom';
      ctx.textAlign    = 'left';

      // TP label (top-left of TP box)
      ctx.fillStyle = col.posTPTxt;
      ctx.fillText(`TP ${fmtPrice(ann.tp)}`, xLeft + 3, yTP - 2);

      // SL label (bottom-left of SL box)
      ctx.textBaseline = 'top';
      ctx.fillStyle = col.posSLTxt;
      ctx.fillText(`SL ${fmtPrice(ann.sl)}`, xLeft + 3, ySL + 2);

      // Entry label
      if (ann.label) {
        ctx.textBaseline = 'bottom';
        ctx.fillStyle    = col.entry;
        ctx.fillText(ann.label, xLeft + 3, yEntry - 3);
      }
    }

    // ── Entry (standalone, without position) ───────────────────────
    if (ann.type === 'entry') {
      const idx = dateMap.get(ann.date);
      if (idx === undefined) continue;

      const x     = toX(idx);
      const y     = toY(ann.price);
      const label = ann.label ?? 'Entry';
      const S     = 6;

      ctx.fillStyle = col.entry;
      ctx.beginPath();
      ctx.moveTo(x, y - S);
      ctx.lineTo(x - S, y + S);
      ctx.lineTo(x + S, y + S);
      ctx.closePath();
      ctx.fill();

      ctx.font         = FONT;
      ctx.fillStyle    = col.entry;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, x, y - S - 3);
    }

    // ── Trendline ──────────────────────────────────────────────────
    if (ann.type === 'trendline') {
      const [d1, f1] = ann.from;
      const [d2, f2] = ann.to;
      const i1 = dateMap.get(d1);
      const i2 = dateMap.get(d2);
      if (i1 === undefined || i2 === undefined) continue;

      const p1 = candles[i1][f1 as OhlcField] as number;
      const p2 = candles[i2][f2 as OhlcField] as number;
      const x1 = toX(i1), y1 = toY(p1);
      const x2 = toX(i2), y2 = toY(p2);
      const color = ann.color ?? col.trend;

      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
}

// ── Main render ───────────────────────────────────────────────────────────

export function renderKlineChart(
  container: HTMLElement,
  candles: Candle[],
  annotations?: Annotation[],
): () => void {
  container.empty();

  const wrapper = container.createDiv({ cls: 'kline-chart-wrapper' });
  const canvas  = wrapper.createEl('canvas');
  canvas.style.display = 'block';
  canvas.style.width   = '100%';
  canvas.style.height  = `${TOTAL_H}px`;

  const intraday = candles.length > 1 && (candles[1].time - candles[0].time) < 86400;

  // Pre-compute bounds — include annotation prices so position boxes are always visible
  const annPrices: number[] = (annotations ?? []).flatMap(a => {
    if (a.type === 'position') return [a.entry, a.sl, a.tp];
    if (a.type === 'entry') return [a.price];
    return [];
  });
  const pMax = Math.max(...candles.map(c => c.high), ...annPrices);
  const pMin = Math.min(...candles.map(c => c.low),  ...annPrices);
  const pPad = (pMax - pMin) * 0.05;
  const yMax = pMax + pPad;
  const yMin = pMin - pPad;
  const vMax = Math.max(...candles.map(c => c.volume));

  function draw() {
    const totalW = wrapper.clientWidth || 640;
    const dpr    = window.devicePixelRatio || 1;

    canvas.width  = totalW * dpr;
    canvas.height = TOTAL_H * dpr;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const dark = isDarkTheme();
    const col  = getColors(dark);

    // Layout
    const chartW   = totalW - PAD.left - PAD.right;
    const chartH   = TOTAL_H - PAD.top - PAD.bottom;
    const priceH   = Math.floor(chartH * (1 - VOL_RATIO) - VOL_GAP / 2);
    const volH     = Math.floor(chartH * VOL_RATIO - VOL_GAP / 2);
    const priceTop = PAD.top;
    const volTop   = PAD.top + priceH + VOL_GAP;

    // Coordinate mappers
    const slotW = chartW / candles.length;
    const bodyW = Math.max(1, Math.min(Math.floor(slotW * 0.7), MAX_BODY_W));

    function toX(i: number): number {
      return PAD.left + (i + 0.5) * slotW;
    }
    function toY(price: number): number {
      return priceTop + priceH * (1 - (price - yMin) / (yMax - yMin));
    }
    function toVolY(vol: number): number {
      return volTop + volH * (1 - vol / vMax);
    }

    // Grid + price labels
    ctx.font = FONT;
    for (let g = 0; g <= GRID_LINES; g++) {
      const price = yMin + (g / GRID_LINES) * (yMax - yMin);
      const y     = toY(price);

      ctx.strokeStyle = col.grid;
      ctx.lineWidth   = 0.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();

      ctx.fillStyle    = col.text;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtPrice(price), PAD.left + chartW + 4, y);
    }

    // Volume divider
    ctx.strokeStyle = col.grid;
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, volTop);
    ctx.lineTo(PAD.left + chartW, volTop);
    ctx.stroke();

    // Annotations FIRST (behind candles so boxes don't cover K-lines)
    if (annotations && annotations.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD.left, PAD.top, chartW, priceH);
      ctx.clip();
      drawAnnotations(ctx, annotations, candles, toX, toY, slotW, chartW, col);
      ctx.restore();
    }

    // Candlesticks (on top of position boxes)
    for (let i = 0; i < candles.length; i++) {
      const c    = candles[i];
      const x    = toX(i);
      const isUp = c.close >= c.open;
      const clr  = isUp ? col.up : col.down;

      ctx.strokeStyle = clr;
      ctx.lineWidth   = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      const top = Math.min(toY(c.open), toY(c.close));
      const bH  = Math.max(1, Math.abs(toY(c.close) - toY(c.open)));
      ctx.fillStyle = clr;
      ctx.fillRect(x - bodyW / 2, top, bodyW, bH);
    }

    // Volume bars
    for (let i = 0; i < candles.length; i++) {
      const c    = candles[i];
      const x    = toX(i);
      const isUp = c.close >= c.open;
      const vY   = toVolY(c.volume);
      ctx.fillStyle = isUp ? col.upVol : col.downVol;
      ctx.fillRect(x - bodyW / 2, vY, bodyW, volTop + volH - vY);
    }

    // Time labels
    ctx.fillStyle    = col.text;
    ctx.font         = FONT;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    const maxLabels = Math.max(2, Math.floor(chartW / 72));
    const step      = Math.max(1, Math.ceil(candles.length / maxLabels));
    for (let i = 0; i < candles.length; i += step) {
      ctx.fillText(fmtDate(candles[i].time, intraday), toX(i), volTop + volH + 6);
    }
  }

  requestAnimationFrame(draw);

  const ro = new ResizeObserver(draw);
  ro.observe(wrapper);

  return () => ro.disconnect();
}
