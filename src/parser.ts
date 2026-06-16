import yaml from 'js-yaml';
import { KlineConfig, Candle } from './types';

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
  if (obj.from) config.from = String(obj.from);
  if (obj.to) config.to = String(obj.to);
  if (obj.annotations && Array.isArray(obj.annotations)) {
    config.annotations = obj.annotations as any;
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
