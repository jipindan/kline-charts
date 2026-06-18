import { Candle, CompareLine } from './types';
import { dayKey } from './renderer';

const COMPARE_COLORS = ['#3b82f6', '#f97316', '#8b5cf6', '#06b6d4'];

export function buildCompareLines(
  mainCandles: Candle[],
  compareData: Map<string, number[][]>,
): CompareLine[] {
  if (mainCandles.length === 0) return [];

  const mainDateMap = new Map<string, number>();
  mainCandles.forEach((c, i) => mainDateMap.set(dayKey(c.time), i));

  const mainBase = mainCandles[0].close;
  const lines: CompareLine[] = [];

  const mainPct: (number | null)[] = mainCandles.map(c => ((c.close - mainBase) / mainBase) * 100);
  lines.push({
    symbol: 'main',
    color: COMPARE_COLORS[0],
    pctValues: mainPct,
  });

  let colorIdx = 1;
  for (const [symbol, rawData] of compareData) {
    const color = COMPARE_COLORS[colorIdx++ % COMPARE_COLORS.length];
    if (rawData.length === 0) continue;

    const compBase = rawData[0][4];
    const pctValues: (number | null)[] = new Array(mainCandles.length).fill(null);

    for (const row of rawData) {
      const ts = row[0];
      const close = row[4];
      const dk = dayKey(ts);
      const mainIdx = mainDateMap.get(dk);
      if (mainIdx !== undefined) {
        pctValues[mainIdx] = ((close - compBase) / compBase) * 100;
      }
    }

    lines.push({ symbol, color, pctValues });
  }

  return lines;
}
