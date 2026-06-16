import { requestUrl } from 'obsidian';

const INTERVAL_MAP: Record<string, string> = {
  '1w': '1wk',
  '1M': '1mo',
};

export async function fetchYahooKlines(
  symbol: string,
  interval: string,
  from?: string,
  to?: string,
): Promise<number[][]> {
  const yInterval = INTERVAL_MAP[interval] ?? interval;

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
  return data;
}

function roundVol(v: number): number {
  if (v >= 1) return Math.round(v);
  return Number(v.toFixed(4));
}
