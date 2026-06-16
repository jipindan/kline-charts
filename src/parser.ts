import yaml from 'js-yaml';
import { KlineConfig, Candle } from './types';

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

function normalizeAnnotation(ann: Record<string, unknown>): Record<string, unknown> {
  if (!ann || typeof ann !== 'object') return ann;
  const a = { ...ann };
  // entry: date field
  if (a.date !== undefined) a.date = toDateStr(a.date);
  // trendline: from/to are [date, field] tuples
  if (Array.isArray(a.from)) a.from = [toDateStr(a.from[0]), a.from[1]];
  if (Array.isArray(a.to))   a.to   = [toDateStr(a.to[0]),   a.to[1]];
  // position: entry_date / exit_date
  if (a.entry_date !== undefined) a.entry_date = toDateStr(a.entry_date);
  if (a.exit_date !== undefined)  a.exit_date  = toDateStr(a.exit_date);
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

  if (obj.provider) config.provider = obj.provider as any;
  if (obj.interval) config.interval = String(obj.interval);
  if (obj.from) config.from = toDateStr(obj.from);
  if (obj.to) config.to = toDateStr(obj.to);
  if (obj.annotations && Array.isArray(obj.annotations)) {
    config.annotations = (obj.annotations as any[]).map(normalizeAnnotation) as any;
  }
  if (obj.data && Array.isArray(obj.data)) {
    config.data = obj.data as number[][];
  }

  return config;
}

export function configToCandles(config: KlineConfig): Candle[] {
  if (!config.data || config.data.length === 0) return [];
  return config.data.map((row, i) => {
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
}
