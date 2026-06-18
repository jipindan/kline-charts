import { requestUrl } from 'obsidian';
import { DataProvider } from './types';

export interface DataFetcher {
  name: string;
  fetch(symbol: string, interval: string, from?: string, to?: string): Promise<number[][]>;
}

const MAX_CANDLES = 2000;

export function roundVol(v: number): number {
  if (v >= 1) return Math.round(v);
  return Number(v.toFixed(4));
}

function capData(data: number[][]): number[][] {
  return data.length > MAX_CANDLES ? data.slice(data.length - MAX_CANDLES) : data;
}

// ── Binance ──────────────────────────────────────────────────────────────

const binanceFetcher: DataFetcher = {
  name: 'binance',
  async fetch(symbol, interval, from, to) {
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval,
      limit: '1000',
    });
    if (from) params.set('startTime', String(new Date(from + 'T00:00:00Z').getTime()));
    if (to)   params.set('endTime',   String(new Date(to + 'T23:59:59.999Z').getTime()));

    const resp = await requestUrl({
      url: `https://api.binance.com/api/v3/klines?${params}`,
    });

    const raw = resp.json;
    if (!Array.isArray(raw)) {
      throw new Error(raw?.msg ?? 'Unexpected response from Binance');
    }
    if (raw.length === 0) {
      throw new Error('No data returned — check symbol and date range');
    }

    return raw.map((k: any[]) => [
      Math.floor(Number(k[0]) / 1000),
      Number(k[1]),
      Number(k[2]),
      Number(k[3]),
      Number(k[4]),
      roundVol(Number(k[5])),
    ]);
  },
};

// ── Yahoo Finance ────────────────────────────────────────────────────────

const YAHOO_INTERVAL_MAP: Record<string, string> = {
  '1w': '1wk',
  '1M': '1mo',
};

const yahooFetcher: DataFetcher = {
  name: 'yahoo',
  async fetch(symbol, interval, from, to) {
    const yInterval = YAHOO_INTERVAL_MAP[interval] ?? interval;

    const params = new URLSearchParams({ interval: yInterval });
    if (from) params.set('period1', String(Math.floor(new Date(from + 'T00:00:00Z').getTime() / 1000)));
    if (to)   params.set('period2', String(Math.floor(new Date(to + 'T23:59:59Z').getTime() / 1000)));
    if (!from && !to) params.set('range', '6mo');

    const resp = await requestUrl({
      url: `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`,
    });

    const body = resp.json;
    const err = body?.chart?.error;
    if (err) throw new Error(`Yahoo Finance: ${err.description ?? err.code}`);

    const result = body?.chart?.result?.[0];
    if (!result) throw new Error('No data returned from Yahoo Finance');

    const timestamps: number[] = result.timestamp;
    const quote = result.indicators?.quote?.[0];
    if (!timestamps?.length || !quote) throw new Error('Empty response from Yahoo Finance');

    const { open, high, low, close, volume } = quote;

    const data: number[][] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (open[i] == null || close[i] == null) continue;
      data.push([
        timestamps[i],
        Number(open[i]),
        Number(high[i]),
        Number(low[i]),
        Number(close[i]),
        roundVol(Number(volume[i] ?? 0)),
      ]);
    }

    if (data.length === 0) throw new Error('No valid candles — check symbol and date range');
    return capData(data);
  },
};

// ── Registry ─────────────────────────────────────────────────────────────

const registry = new Map<string, DataFetcher>([
  ['binance', binanceFetcher],
  ['yahoo', yahooFetcher],
]);

export function getProvider(name: DataProvider): DataFetcher {
  const fetcher = registry.get(name);
  if (!fetcher) throw new Error(`Unknown provider: ${name}`);
  return fetcher;
}
