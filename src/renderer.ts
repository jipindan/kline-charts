import { setIcon } from 'obsidian';
import { Candle, KlineConfig, KlinePluginSettings, RenderOptions, ColorStyle, Annotation, OhlcField, IndicatorDef, CompareLine } from './types';
import { IndicatorLine, computeIndicators } from './indicators';
import { DrawingState, snapToCandle, drawPreviewLine, formatDrawnAnnotation, extendLineToChart } from './drawing';

// ── Helpers ───────────────────────────────────────────────────────────────

function isDarkTheme(): boolean {
  return document.body.classList.contains('theme-dark');
}

const GREEN = '#26a69a';
const RED   = '#ef5350';

type Colors = ReturnType<typeof getColors>;

function getColors(dark: boolean, style: ColorStyle) {
  const up   = style === 'cn' ? RED : GREEN;
  const down = style === 'cn' ? GREEN : RED;
  return {
    text:     dark ? '#9ca3af' : '#6b7280',
    grid:     dark ? '#2d3748' : '#e5e7eb',
    up,
    down,
    upVol:    up + '4d',
    downVol:  down + '4d',
    entry:    '#f59e0b',
    trend:    '#60a5fa',
    posTP:    GREEN + '20',
    posSL:    RED + '20',
    posTPTxt: GREEN + 'CC',
    posSLTxt: RED + 'CC',
  };
}

export function fmtPrice(price: number): string {
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

export function dayKey(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// ── Error / no-data states ────────────────────────────────────────────────

export function renderError(container: HTMLElement, message: string, onRetry?: () => void): void {
  container.empty();
  const el = container.createDiv({ cls: 'kline-error' });
  el.createSpan({ text: `⚠ ${message}` });
  if (onRetry) {
    const btn = el.createEl('button', { cls: 'kline-retry-btn', text: 'Retry' });
    btn.addEventListener('click', (e) => { e.preventDefault(); onRetry(); });
  }
}

export function renderNoData(
  container: HTMLElement,
  config: KlineConfig,
  onFetch: () => void,
): void {
  container.empty();
  const el = container.createDiv({ cls: 'kline-fetch-container' });

  const parts = [config.symbol, config.interval!, config.provider!];
  if (config.from) parts.push(`${config.from} → ${config.to ?? 'now'}`);
  el.createDiv({ cls: 'kline-fetch-meta', text: parts.join(' · ') });

  const btn = el.createEl('button', { cls: 'kline-fetch-btn', text: 'Fetch Data' });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    onFetch();
  });
}

export function renderTruncationNotice(container: HTMLElement): void {
  const notice = container.createDiv({ cls: 'kline-truncation-notice' });
  notice.setText('Showing latest 2000 candles');
}

export function renderLoading(container: HTMLElement, config: KlineConfig): void {
  container.empty();
  const el = container.createDiv({ cls: 'kline-fetch-container' });
  el.createDiv({ cls: 'kline-fetch-meta', text: `Fetching ${config.symbol}…` });
  el.createDiv({ cls: 'kline-spinner' });
}

// ── Chart layout ─────────────────────────────────────────────────────────

const PAD        = { top: 20, right: 72, bottom: 36, left: 8 };
const VOL_RATIO  = 0.2;
const VOL_GAP    = 6;
const FONT       = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const GRID_LINES = 5;
const MAX_BODY_W = 14;

export interface ChartLayout {
  totalW: number;
  totalH: number;
  chartW: number;
  chartH: number;
  priceH: number;
  priceTop: number;
  volH: number;
  volTop: number;
  slotW: number;
  bodyW: number;
  yMin: number;
  yMax: number;
  vMax: number;
  showVolume: boolean;
  intraday: boolean;
  toX(i: number): number;
  toY(price: number): number;
  toVolY(vol: number): number;
}

function computeLayout(
  totalW: number,
  candles: Candle[],
  annotations: Annotation[] | undefined,
  options: RenderOptions,
): ChartLayout {
  const totalH     = options.chartHeight;
  const showVolume = options.showVolume;
  const intraday   = candles.length > 1 && (candles[1].time - candles[0].time) < 86400;

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
  const vMax = showVolume ? Math.max(...candles.map(c => c.volume)) : 0;

  const chartW = totalW - PAD.left - PAD.right;
  const chartH = totalH - PAD.top - PAD.bottom;

  let priceH: number, volH: number, volTop: number;
  if (showVolume) {
    priceH = Math.floor(chartH * (1 - VOL_RATIO) - VOL_GAP / 2);
    volH   = Math.floor(chartH * VOL_RATIO - VOL_GAP / 2);
    volTop = PAD.top + priceH + VOL_GAP;
  } else {
    priceH = chartH;
    volH   = 0;
    volTop = 0;
  }
  const priceTop = PAD.top;

  const slotW = chartW / candles.length;
  const bodyW = Math.max(1, Math.min(Math.floor(slotW * 0.7), MAX_BODY_W));

  return {
    totalW, totalH, chartW, chartH,
    priceH, priceTop, volH, volTop,
    slotW, bodyW, yMin, yMax, vMax,
    showVolume, intraday,
    toX:    (i: number) => PAD.left + (i + 0.5) * slotW,
    toY:    (price: number) => priceTop + priceH * (1 - (price - yMin) / (yMax - yMin)),
    toVolY: (vol: number) => volTop + volH * (1 - vol / vMax),
  };
}

// ── Drawing functions ────────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, layout: ChartLayout, col: Colors) {
  ctx.font = FONT;
  for (let g = 0; g <= GRID_LINES; g++) {
    const price = layout.yMin + (g / GRID_LINES) * (layout.yMax - layout.yMin);
    const y     = layout.toY(price);

    ctx.strokeStyle = col.grid;
    ctx.lineWidth   = 0.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + layout.chartW, y);
    ctx.stroke();

    ctx.fillStyle    = col.text;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmtPrice(price), PAD.left + layout.chartW + 4, y);
  }

  if (layout.showVolume) {
    ctx.strokeStyle = col.grid;
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, layout.volTop);
    ctx.lineTo(PAD.left + layout.chartW, layout.volTop);
    ctx.stroke();
  }
}

function drawCandles(ctx: CanvasRenderingContext2D, candles: Candle[], layout: ChartLayout, col: Colors) {
  for (let i = 0; i < candles.length; i++) {
    const c    = candles[i];
    const x    = layout.toX(i);
    const isUp = c.close >= c.open;
    const clr  = isUp ? col.up : col.down;

    ctx.strokeStyle = clr;
    ctx.lineWidth   = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, layout.toY(c.high));
    ctx.lineTo(x, layout.toY(c.low));
    ctx.stroke();

    const top = Math.min(layout.toY(c.open), layout.toY(c.close));
    const bH  = Math.max(1, Math.abs(layout.toY(c.close) - layout.toY(c.open)));
    ctx.fillStyle = clr;
    ctx.fillRect(x - layout.bodyW / 2, top, layout.bodyW, bH);
  }
}

function drawVolume(ctx: CanvasRenderingContext2D, candles: Candle[], layout: ChartLayout, col: Colors) {
  if (!layout.showVolume) return;
  for (let i = 0; i < candles.length; i++) {
    const c    = candles[i];
    const x    = layout.toX(i);
    const isUp = c.close >= c.open;
    const vY   = layout.toVolY(c.volume);
    ctx.fillStyle = isUp ? col.upVol : col.downVol;
    ctx.fillRect(x - layout.bodyW / 2, vY, layout.bodyW, layout.volTop + layout.volH - vY);
  }
}

function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  candles: Candle[],
  layout: ChartLayout,
  col: Colors,
) {
  const dateMap = new Map<string, number>();
  candles.forEach((c, i) => dateMap.set(dayKey(c.time), i));

  for (const ann of annotations) {

    if (ann.type === 'position') {
      const i1 = dateMap.get(ann.entry_date);
      const i2 = dateMap.get(ann.exit_date);
      if (i1 === undefined || i2 === undefined) continue;

      const xLeft  = layout.toX(i1);
      const xRight = layout.toX(i2);
      const boxW   = xRight - xLeft;

      const yEntry = layout.toY(ann.entry);
      const yTP    = layout.toY(ann.tp);
      const ySL    = layout.toY(ann.sl);

      ctx.fillStyle = col.posTP;
      ctx.fillRect(xLeft, yTP, boxW, yEntry - yTP);

      ctx.fillStyle = col.posSL;
      ctx.fillRect(xLeft, yEntry, boxW, ySL - yEntry);

      ctx.font         = FONT;
      ctx.textBaseline = 'bottom';
      ctx.textAlign    = 'left';

      ctx.fillStyle = col.posTPTxt;
      ctx.fillText(`TP ${fmtPrice(ann.tp)}`, xLeft + 3, yTP - 2);

      ctx.textBaseline = 'top';
      ctx.fillStyle = col.posSLTxt;
      ctx.fillText(`SL ${fmtPrice(ann.sl)}`, xLeft + 3, ySL + 2);

      if (ann.label) {
        ctx.textBaseline = 'bottom';
        ctx.fillStyle    = col.entry;
        ctx.fillText(ann.label, xLeft + 3, yEntry - 3);
      }
    }

    if (ann.type === 'entry') {
      const idx = dateMap.get(ann.date);
      if (idx === undefined) continue;

      const x     = layout.toX(idx);
      const y     = layout.toY(ann.price);
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

    if (ann.type === 'trendline') {
      const [d1, f1] = ann.from;
      const [d2, f2] = ann.to;
      const i1 = dateMap.get(d1);
      const i2 = dateMap.get(d2);
      if (i1 === undefined || i2 === undefined) continue;

      const p1 = candles[i1][f1 as OhlcField] as number;
      const p2 = candles[i2][f2 as OhlcField] as number;
      const ax1 = layout.toX(i1), ay1 = layout.toY(p1);
      const ax2 = layout.toX(i2), ay2 = layout.toY(p2);
      const autoColor = p2 > p1 ? col.up : p2 < p1 ? col.down : col.trend;
      const color = ann.color ?? autoColor;

      let lx1 = ax1, ly1 = ay1, lx2 = ax2, ly2 = ay2;
      if (ann.extend) {
        const ext = extendLineToChart(ax1, ay1, ax2, ay2, PAD.left, PAD.left + layout.chartW);
        lx1 = ext.x1; ly1 = ext.y1; lx2 = ext.x2; ly2 = ext.y2;
      }

      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(lx1, ly1);
      ctx.lineTo(lx2, ly2);
      ctx.stroke();
    }
  }
}

function drawTimeAxis(ctx: CanvasRenderingContext2D, candles: Candle[], layout: ChartLayout, col: Colors) {
  const timeLabelY = layout.showVolume ? layout.volTop + layout.volH + 6 : layout.priceTop + layout.priceH + 6;
  ctx.fillStyle    = col.text;
  ctx.font         = FONT;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';

  const maxLabels = Math.max(2, Math.floor(layout.chartW / 72));
  const step      = Math.max(1, Math.ceil(candles.length / maxLabels));
  for (let i = 0; i < candles.length; i += step) {
    ctx.fillText(fmtDate(candles[i].time, layout.intraday), layout.toX(i), timeLabelY);
  }
}

// ── Indicators ───────────────────────────────────────────────────────────

function drawIndicatorLines(
  ctx: CanvasRenderingContext2D,
  lines: IndicatorLine[],
  layout: ChartLayout,
) {
  for (const line of lines) {
    ctx.strokeStyle = line.color;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < line.values.length; i++) {
      const v = line.values[i];
      if (v === null) { started = false; continue; }
      const x = layout.toX(i);
      const y = layout.toY(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  lines: IndicatorLine[],
  layout: ChartLayout,
) {
  if (lines.length === 0) return;
  ctx.font         = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'left';

  let x = PAD.left + 4;
  const y = PAD.top + 4;

  for (const line of lines) {
    ctx.fillStyle = line.color;
    ctx.fillRect(x, y + 2, 12, 3);
    x += 16;
    ctx.fillText(line.label, x, y);
    x += ctx.measureText(line.label).width + 10;
  }
}

// ── Compare overlay ──────────────────────────────────────────────────────

function drawCompareLines(
  ctx: CanvasRenderingContext2D,
  lines: CompareLine[],
  layout: ChartLayout,
) {
  const allPcts = lines.flatMap(l => l.pctValues.filter(v => v !== null) as number[]);
  if (allPcts.length === 0) return;

  const pctMax = Math.max(...allPcts) * 1.1;
  const pctMin = Math.min(...allPcts) * 1.1;
  const pctRange = pctMax - pctMin || 1;

  const toPctY = (pct: number) => layout.priceTop + layout.priceH * (1 - (pct - pctMin) / pctRange);

  for (const line of lines) {
    ctx.strokeStyle = line.color;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < line.pctValues.length; i++) {
      const v = line.pctValues[i];
      if (v === null) { started = false; continue; }
      const x = layout.toX(i);
      const y = toPctY(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.font         = FONT;
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  const steps = 5;
  for (let g = 0; g <= steps; g++) {
    const pct = pctMin + (g / steps) * pctRange;
    const y = toPctY(pct);
    ctx.fillStyle = lines[0]?.color ?? '#888';
    const sign = pct >= 0 ? '+' : '';
    ctx.fillText(`${sign}${pct.toFixed(1)}%`, PAD.left + layout.chartW - 4, y);
  }
}

function drawCompareLegend(
  ctx: CanvasRenderingContext2D,
  lines: CompareLine[],
  mainSymbol: string,
  layout: ChartLayout,
) {
  ctx.font         = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign    = 'right';

  let x = PAD.left + layout.chartW - 4;
  const y = PAD.top + 4;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const label = line.symbol === 'main' ? mainSymbol : line.symbol;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = line.color;
    ctx.fillText(label, x, y);
    x -= tw + 4;
    ctx.fillRect(x - 12, y + 2, 12, 3);
    x -= 20;
  }
}

// ── Crosshair + Tooltip ──────────────────────────────────────────────────

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  col: Colors,
  mouseY: number,
  idx: number,
) {
  const x = layout.toX(idx);

  ctx.strokeStyle = col.text;
  ctx.lineWidth   = 0.5;
  ctx.setLineDash([4, 3]);

  ctx.beginPath();
  ctx.moveTo(x, PAD.top);
  ctx.lineTo(x, layout.totalH - PAD.bottom);
  ctx.stroke();

  if (mouseY >= layout.priceTop && mouseY <= layout.priceTop + layout.priceH) {
    ctx.beginPath();
    ctx.moveTo(PAD.left, mouseY);
    ctx.lineTo(PAD.left + layout.chartW, mouseY);
    ctx.stroke();

    ctx.setLineDash([]);
    const price = layout.yMax - (mouseY - layout.priceTop) / layout.priceH * (layout.yMax - layout.yMin);
    ctx.font         = FONT;
    ctx.fillStyle    = col.text;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fmtPrice(price), PAD.left + layout.chartW + 4, mouseY);
  }

  ctx.setLineDash([]);
}

function formatTooltip(candle: Candle, prev: Candle | null, intraday: boolean): string {
  const d = new Date(candle.time * 1000);
  const date = intraday
    ? `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`
    : `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;

  let changePct = '';
  if (prev) {
    const pct = ((candle.close - prev.close) / prev.close * 100);
    const sign = pct >= 0 ? '+' : '';
    changePct = `<div class="kline-tooltip-row"><span>Chg</span><span>${sign}${pct.toFixed(2)}%</span></div>`;
  }

  const vol = candle.volume >= 1e6
    ? (candle.volume / 1e6).toFixed(2) + 'M'
    : candle.volume >= 1e3
      ? (candle.volume / 1e3).toFixed(1) + 'K'
      : String(candle.volume);

  return `<div class="kline-tooltip-date">${date}</div>
<div class="kline-tooltip-row"><span>O</span><span>${fmtPrice(candle.open)}</span></div>
<div class="kline-tooltip-row"><span>H</span><span>${fmtPrice(candle.high)}</span></div>
<div class="kline-tooltip-row"><span>L</span><span>${fmtPrice(candle.low)}</span></div>
<div class="kline-tooltip-row"><span>C</span><span>${fmtPrice(candle.close)}</span></div>
<div class="kline-tooltip-row"><span>V</span><span>${vol}</span></div>
${changePct}`;
}

// ── Main render ───────────────────────────────────────────────────────────

export function renderKlineChart(
  container: HTMLElement,
  candles: Candle[],
  annotations: Annotation[] | undefined,
  options: RenderOptions,
  indicatorDefs?: IndicatorDef[],
  compareLines?: CompareLine[],
  mainSymbol?: string,
  onDrawLine?: (annotationYaml: string) => void,
): () => void {
  container.empty();

  const wrapper = container.createDiv({ cls: 'kline-chart-wrapper' });
  wrapper.style.position = 'relative';

  const canvas = wrapper.createEl('canvas');
  canvas.style.display = 'block';
  canvas.style.width   = '100%';
  canvas.style.height  = `${options.chartHeight}px`;

  const overlay = wrapper.createEl('canvas', { cls: 'kline-overlay' });
  overlay.style.position = 'absolute';
  overlay.style.top      = '0';
  overlay.style.left     = '0';
  overlay.style.width    = '100%';
  overlay.style.height   = `${options.chartHeight}px`;
  overlay.style.pointerEvents = 'auto';

  const tooltip = wrapper.createDiv({ cls: 'kline-tooltip' });

  const pencilBtn = wrapper.createDiv({ cls: 'kline-pencil-btn' });
  setIcon(pencilBtn, 'pencil-line');
  const drawState: DrawingState = { active: false, start: null };

  pencilBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    drawState.active = !drawState.active;
    drawState.start  = null;
    pencilBtn.toggleClass('kline-pencil-active', drawState.active);
    overlay.style.cursor = drawState.active ? 'crosshair' : '';
    clearOverlay();
  });

  let currentLayout: ChartLayout | null = null;

  function draw() {
    const totalW = wrapper.clientWidth || 640;
    const dpr    = window.devicePixelRatio || 1;
    const layout = computeLayout(totalW, candles, annotations, options);
    const col    = getColors(isDarkTheme(), options.colorStyle);
    currentLayout = layout;

    canvas.width  = totalW * dpr;
    canvas.height = layout.totalH * dpr;
    overlay.width  = totalW * dpr;
    overlay.height = layout.totalH * dpr;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    drawGrid(ctx, layout, col);

    if (annotations && annotations.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD.left, PAD.top, layout.chartW, layout.priceH);
      ctx.clip();
      drawAnnotations(ctx, annotations, candles, layout, col);
      ctx.restore();
    }

    drawCandles(ctx, candles, layout, col);
    drawVolume(ctx, candles, layout, col);

    if (indicatorDefs && indicatorDefs.length > 0) {
      const lines = computeIndicators(candles, indicatorDefs);
      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD.left, PAD.top, layout.chartW, layout.priceH);
      ctx.clip();
      drawIndicatorLines(ctx, lines, layout);
      ctx.restore();
      drawLegend(ctx, lines, layout);
    }

    if (compareLines && compareLines.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(PAD.left, PAD.top, layout.chartW, layout.priceH);
      ctx.clip();
      drawCompareLines(ctx, compareLines, layout);
      ctx.restore();
      drawCompareLegend(ctx, compareLines, mainSymbol ?? '', layout);
    }

    drawTimeAxis(ctx, candles, layout, col);
  }

  function onMouseMove(e: MouseEvent) {
    if (!currentLayout) return;
    const layout = currentLayout;
    const rect = overlay.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (mx < PAD.left || mx > PAD.left + layout.chartW || my < PAD.top || my > layout.totalH - PAD.bottom) {
      if (!drawState.start) clearOverlay();
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const octx = overlay.getContext('2d')!;
    const col  = getColors(isDarkTheme(), options.colorStyle);

    if (drawState.active && drawState.start) {
      const snap = snapToCandle(mx, my, candles, layout);
      const endX = snap ? layout.toX(snap.candleIdx) : mx;
      const endY = snap ? layout.toY(snap.price)     : my;
      drawPreviewLine(octx, dpr, drawState.start, endX, endY, layout, e.shiftKey);
      tooltip.style.display = 'none';
      return;
    }

    const idx = Math.round((mx - PAD.left) / layout.slotW - 0.5);
    if (idx < 0 || idx >= candles.length) { clearOverlay(); return; }

    if (drawState.active) {
      const snap = snapToCandle(mx, my, candles, layout);
      const snapX = snap ? layout.toX(snap.candleIdx) : mx;
      const snapY = snap ? layout.toY(snap.price)     : my;
      const snapIdx = snap?.candleIdx ?? idx;
      octx.clearRect(0, 0, overlay.width, overlay.height);
      octx.scale(dpr, dpr);
      drawCrosshair(octx, layout, col, snapY, snapIdx);
      if (snap) {
        octx.fillStyle   = '#60a5fa';
        octx.strokeStyle = col.grid;
        octx.lineWidth   = 1.5;
        octx.beginPath();
        octx.arc(snapX, snapY, 5, 0, Math.PI * 2);
        octx.fill();
        octx.stroke();
      }
      octx.setTransform(1, 0, 0, 1, 0, 0);
      tooltip.style.display = 'none';
      return;
    }

    const candle = candles[idx];
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.scale(dpr, dpr);
    drawCrosshair(octx, layout, col, my, idx);
    octx.setTransform(1, 0, 0, 1, 0, 0);

    tooltip.innerHTML = formatTooltip(candle, idx > 0 ? candles[idx - 1] : null, layout.intraday);
    tooltip.style.display = 'block';

    const tipX = layout.toX(idx);
    const tipW = 130;
    const wrapW = rect.width;
    tooltip.style.left = (tipX + tipW + 20 > wrapW ? tipX - tipW - 10 : tipX + 10) + 'px';
    tooltip.style.top  = PAD.top + 'px';
  }

  function onMouseDown(e: MouseEvent) {
    if (!drawState.active || !currentLayout) return;
    const rect = overlay.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const snap = snapToCandle(mx, my, candles, currentLayout);
    if (!snap) return;

    if (!drawState.start) {
      drawState.start = snap;
    } else {
      const end = snap;
      if (onDrawLine) {
        onDrawLine(formatDrawnAnnotation(drawState.start, end, candles, e.shiftKey));
      }
      drawState.start  = null;
      drawState.active = false;
      pencilBtn.removeClass('kline-pencil-active');
      overlay.style.cursor = '';
      clearOverlay();
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && drawState.active) {
      drawState.active = false;
      drawState.start  = null;
      pencilBtn.removeClass('kline-pencil-active');
      overlay.style.cursor = '';
      clearOverlay();
    }
  }

  function clearOverlay() {
    const octx = overlay.getContext('2d');
    if (octx) octx.clearRect(0, 0, overlay.width, overlay.height);
    tooltip.style.display = 'none';
  }

  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('mouseleave', () => { if (!drawState.start) clearOverlay(); });
  overlay.addEventListener('mousedown', onMouseDown);
  document.addEventListener('keydown', onKeyDown);

  requestAnimationFrame(draw);

  let rafId = 0;
  const scheduleDraw = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(draw);
  };

  const ro = new ResizeObserver(scheduleDraw);
  ro.observe(wrapper);

  const mo = new MutationObserver(scheduleDraw);
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  return () => {
    ro.disconnect();
    mo.disconnect();
    cancelAnimationFrame(rafId);
    overlay.removeEventListener('mousemove', onMouseMove);
    overlay.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('keydown', onKeyDown);
  };
}
