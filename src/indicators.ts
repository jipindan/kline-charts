import { Candle } from './types';

export interface IndicatorLine {
  label: string;
  color: string;
  values: (number | null)[];
}

const DEFAULT_COLORS = ['#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

export interface IndicatorConfig {
  ma?: number;
  ema?: number;
  color?: string;
}

export function calcMA(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    result.push(sum / period);
  }
  return result;
}

export function calcEMA(candles: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const k = 2 / (period + 1);
  let ema: number | null = null;

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (ema === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
      ema = sum / period;
    } else {
      ema = candles[i].close * k + ema * (1 - k);
    }
    result.push(ema);
  }
  return result;
}

export function computeIndicators(candles: Candle[], configs: IndicatorConfig[]): IndicatorLine[] {
  const lines: IndicatorLine[] = [];
  let colorIdx = 0;

  for (const cfg of configs) {
    const fallbackColor = DEFAULT_COLORS[colorIdx++ % DEFAULT_COLORS.length];

    if (cfg.ma !== undefined) {
      lines.push({
        label: `MA${cfg.ma}`,
        color: cfg.color ?? fallbackColor,
        values: calcMA(candles, cfg.ma),
      });
    }
    if (cfg.ema !== undefined) {
      lines.push({
        label: `EMA${cfg.ema}`,
        color: cfg.color ?? fallbackColor,
        values: calcEMA(candles, cfg.ema),
      });
    }
  }

  return lines;
}
