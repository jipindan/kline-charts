import yaml from 'js-yaml';
import { KlineConfig, Candle, DataProvider, ColorStyle, Annotation, OhlcField, IndicatorDef } from './types';

const VALID_PROVIDERS: DataProvider[] = ['binance', 'yahoo'];
const VALID_INTERVAL = /^\d+[mhdwM]$/;
const VALID_ANNOTATION_TYPES = ['entry', 'trendline', 'position'];
const VALID_COLOR_STYLES: ColorStyle[] = ['international', 'cn'];
const VALID_OHLC: OhlcField[] = ['open', 'high', 'low', 'close'];

/** js-yaml parses YYYY-MM-DD as a Date object — convert back to string */
function toDateStr(val: unknown): string {
  if (val instanceof Date) {
    const y  = val.getUTCFullYear();
    const m  = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d  = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val);
}

const VALID_HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

function normalizeAnnotation(ann: Record<string, unknown>): Record<string, unknown> {
  if (!ann || typeof ann !== 'object') return ann;
  const a = { ...ann };
  if (a.date !== undefined) a.date = toDateStr(a.date);
  if (Array.isArray(a.from)) a.from = [toDateStr(a.from[0]), a.from[1]];
  if (Array.isArray(a.to))   a.to   = [toDateStr(a.to[0]),   a.to[1]];
  if (a.entry_date !== undefined) a.entry_date = toDateStr(a.entry_date);
  if (a.exit_date !== undefined)  a.exit_date  = toDateStr(a.exit_date);
  if (a.color !== undefined && (typeof a.color !== 'string' || !VALID_HEX_COLOR.test(a.color))) {
    delete a.color;
  }
  return a;
}

export function parseKlineConfig(source: string): KlineConfig {
  let raw: unknown;
  try {
    raw = yaml.load(source);
  } catch (e) {
    throw new Error(`YAML parse error: ${(e as Error).message}`);
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid config: expected a YAML object');
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.symbol || typeof obj.symbol !== 'string') {
    throw new Error('Missing required field: symbol (e.g. symbol: BTCUSDT)');
  }

  const config: KlineConfig = { symbol: obj.symbol.toUpperCase() };

  if (obj.provider) {
    const p = String(obj.provider);
    if (!VALID_PROVIDERS.includes(p as DataProvider)) {
      throw new Error(`Unknown provider: ${p} (expected: ${VALID_PROVIDERS.join(', ')})`);
    }
    config.provider = p as DataProvider;
  }
  if (obj.interval) {
    const iv = String(obj.interval);
    if (!VALID_INTERVAL.test(iv)) {
      throw new Error(`Invalid interval: ${iv} (expected format like 1d, 4h, 15m, 1w, 1M)`);
    }
    config.interval = iv;
  }
  if (obj.from) config.from = toDateStr(obj.from);
  if (obj.to) config.to = toDateStr(obj.to);
  if (obj.annotations && Array.isArray(obj.annotations)) {
    config.annotations = (obj.annotations as Record<string, unknown>[])
      .map(normalizeAnnotation)
      .filter(a => VALID_ANNOTATION_TYPES.includes(String(a.type))) as unknown as Annotation[];
  }
  if (obj.data && Array.isArray(obj.data)) {
    config.data = obj.data as number[][];
  }

  if (obj.height !== undefined) {
    const h = Number(obj.height);
    if (h >= 200 && h <= 600) config.height = h;
  }
  if (obj.volume !== undefined) {
    config.volume = Boolean(obj.volume);
  }
  if (obj.color !== undefined) {
    const c = String(obj.color);
    if (VALID_COLOR_STYLES.includes(c as ColorStyle)) config.color = c as ColorStyle;
  }
  if (obj.indicators && Array.isArray(obj.indicators)) {
    config.indicators = (obj.indicators as Record<string, unknown>[])
      .map(ind => {
        const def: IndicatorDef = {};
        if (ind.ma !== undefined) def.ma = Number(ind.ma);
        if (ind.ema !== undefined) def.ema = Number(ind.ema);
        if (typeof ind.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(ind.color)) def.color = ind.color;
        return def;
      })
      .filter(d => d.ma !== undefined || d.ema !== undefined);
  }
  if (obj.compare && Array.isArray(obj.compare)) {
    config.compare = (obj.compare as unknown[])
      .map(s => String(s).toUpperCase())
      .filter(s => s.length > 0);
  }

  return config;
}

const MAX_CANDLES = 2000;

export function configToCandles(config: KlineConfig): { candles: Candle[]; truncated: boolean } {
  if (!config.data || config.data.length === 0) return { candles: [], truncated: false };

  const raw = config.data;
  const truncated = raw.length > MAX_CANDLES;
  const slice = truncated ? raw.slice(raw.length - MAX_CANDLES) : raw;

  const candles = slice.map((row, i) => {
    if (!Array.isArray(row) || row.length < 5) {
      throw new Error(`data[${i}]: expected [time, open, high, low, close, volume?]`);
    }
    return {
      time: row[0],
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5] ?? 0,
    };
  });

  return { candles, truncated };
}

export function appendData(source: string, data: number[][]): string {
  const lines = source.split('\n');
  const idx = lines.findIndex(l => /^data:/.test(l));
  const header = idx >= 0 ? lines.slice(0, idx) : [...lines];
  while (header.length > 0 && header[header.length - 1].trim() === '') header.pop();
  const dataLines = ['data:'];
  for (const row of data) {
    dataLines.push(`  - [${row.join(', ')}]`);
  }
  return [...header, ...dataLines].join('\n');
}
