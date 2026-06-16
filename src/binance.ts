import { requestUrl } from 'obsidian';

export async function fetchBinanceKlines(
  symbol: string,
  interval: string,
  from?: string,
  to?: string,
): Promise<number[][]> {
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
}

function roundVol(v: number): number {
  if (v >= 1) return Math.round(v);
  return Number(v.toFixed(4));
}
