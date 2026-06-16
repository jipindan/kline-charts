import { Candle, KlineConfig } from './types';

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
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (!intraday) return `${mm}/${dd}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mn = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mn}`;
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

const PAD         = { top: 20, right: 72, bottom: 36, left: 8 };
const TOTAL_H     = 380;
const VOL_RATIO   = 0.2;
const VOL_GAP     = 6;
const FONT        = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const GRID_LINES  = 5;
const MAX_BODY_W  = 14;

export function renderKlineChart(container: HTMLElement, candles: Candle[]): () => void {
  container.empty();

  const wrapper = container.createDiv({ cls: 'kline-chart-wrapper' });
  const canvas  = wrapper.createEl('canvas');
  canvas.style.display = 'block';
  canvas.style.width   = '100%';
  canvas.style.height  = `${TOTAL_H}px`;

  const intraday = candles.length > 1 && (candles[1].time - candles[0].time) < 86400;

  // Pre-compute price & volume bounds
  const pMax  = Math.max(...candles.map(c => c.high));
  const pMin  = Math.min(...candles.map(c => c.low));
  const pPad  = (pMax - pMin) * 0.05;
  const yMax  = pMax + pPad;
  const yMin  = pMin - pPad;
  const vMax  = Math.max(...candles.map(c => c.volume));

  function draw() {
    const totalW = wrapper.clientWidth || 640;
    const dpr    = window.devicePixelRatio || 1;

    canvas.width  = totalW * dpr;
    canvas.height = TOTAL_H * dpr;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const dark = isDarkTheme();
    const col  = getColors(dark);

    // ── Layout ────────────────────────────────────────────────────
    const chartW   = totalW - PAD.left - PAD.right;
    const chartH   = TOTAL_H - PAD.top - PAD.bottom;
    const priceH   = Math.floor(chartH * (1 - VOL_RATIO) - VOL_GAP / 2);
    const volH     = Math.floor(chartH * VOL_RATIO - VOL_GAP / 2);
    const priceTop = PAD.top;
    const volTop   = PAD.top + priceH + VOL_GAP;

    // ── Coordinate mappers ────────────────────────────────────────
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

    // ── Grid + price labels ───────────────────────────────────────
    ctx.font      = FONT;
    ctx.fillStyle = col.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let g = 0; g <= GRID_LINES; g++) {
      const price = yMin + (g / GRID_LINES) * (yMax - yMin);
      const y     = toY(price);

      ctx.strokeStyle = col.grid;
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();

      ctx.fillStyle = col.text;
      ctx.fillText(fmtPrice(price), PAD.left + chartW + 4, y);
    }

    // Volume divider
    ctx.strokeStyle = col.grid;
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, volTop);
    ctx.lineTo(PAD.left + chartW, volTop);
    ctx.stroke();

    // ── Candlesticks ──────────────────────────────────────────────
    for (let i = 0; i < candles.length; i++) {
      const c   = candles[i];
      const x   = toX(i);
      const isUp = c.close >= c.open;
      const clr  = isUp ? col.up : col.down;

      // Wick
      ctx.strokeStyle = clr;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      // Body
      const top = Math.min(toY(c.open), toY(c.close));
      const bH  = Math.max(1, Math.abs(toY(c.close) - toY(c.open)));
      ctx.fillStyle = clr;
      ctx.fillRect(x - bodyW / 2, top, bodyW, bH);
    }

    // ── Volume bars ───────────────────────────────────────────────
    for (let i = 0; i < candles.length; i++) {
      const c   = candles[i];
      const x   = toX(i);
      const isUp = c.close >= c.open;
      const vY  = toVolY(c.volume);
      ctx.fillStyle = isUp ? col.upVol : col.downVol;
      ctx.fillRect(x - bodyW / 2, vY, bodyW, volTop + volH - vY);
    }

    // ── Time labels ───────────────────────────────────────────────
    ctx.fillStyle    = col.text;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.font = FONT;

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
