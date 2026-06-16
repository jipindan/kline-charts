import { createChart, CandlestickSeries, HistogramSeries, UTCTimestamp, IChartApi } from 'lightweight-charts';
import { Candle } from './types';

// BTC/USDT daily candles, Jan 1–20 2024 — used for P0 hardcoded demo
const SAMPLE_CANDLES: Candle[] = [
  { time: 1704067200, open: 42626, high: 44706, low: 42588, close: 44186, volume: 48123 },
  { time: 1704153600, open: 44186, high: 45922, low: 43782, close: 45418, volume: 52341 },
  { time: 1704240000, open: 45418, high: 45700, low: 43515, close: 43831, volume: 47892 },
  { time: 1704326400, open: 43831, high: 44248, low: 42480, close: 43980, volume: 44123 },
  { time: 1704412800, open: 43980, high: 44895, low: 43200, close: 44168, volume: 39876 },
  { time: 1704499200, open: 44168, high: 44612, low: 42940, close: 43450, volume: 41234 },
  { time: 1704585600, open: 43450, high: 43918, low: 41784, close: 42800, volume: 53421 },
  { time: 1704672000, open: 42800, high: 43124, low: 41521, close: 41762, volume: 61234 },
  { time: 1704758400, open: 41762, high: 43000, low: 41200, close: 42738, volume: 49876 },
  { time: 1704844800, open: 42738, high: 43600, low: 42150, close: 43120, volume: 38921 },
  { time: 1704931200, open: 43120, high: 43830, low: 42380, close: 43482, volume: 41234 },
  { time: 1705017600, open: 43482, high: 45800, low: 43200, close: 45675, volume: 72341 },
  { time: 1705104000, open: 45675, high: 46450, low: 44900, close: 45890, volume: 58923 },
  { time: 1705190400, open: 45890, high: 46200, low: 44500, close: 44720, volume: 52134 },
  { time: 1705276800, open: 44720, high: 45100, low: 43800, close: 44234, volume: 43218 },
  { time: 1705363200, open: 44234, high: 44900, low: 43100, close: 43522, volume: 47123 },
  { time: 1705449600, open: 43522, high: 43900, low: 41900, close: 42180, volume: 59234 },
  { time: 1705536000, open: 42180, high: 42600, low: 40500, close: 41200, volume: 68912 },
  { time: 1705622400, open: 41200, high: 41800, low: 39900, close: 41050, volume: 71234 },
  { time: 1705708800, open: 41050, high: 42300, low: 40800, close: 41870, volume: 55621 },
];

function isDarkTheme(): boolean {
  return document.body.classList.contains('theme-dark');
}

export function renderKlineChart(container: HTMLElement, candles?: Candle[]): () => void {
  container.empty();

  const data = candles ?? SAMPLE_CANDLES;
  const dark = isDarkTheme();

  const wrapper = container.createDiv({ cls: 'kline-chart-wrapper' });
  const chartDiv = wrapper.createDiv({ cls: 'kline-chart-canvas' });
  chartDiv.style.height = '380px';

  const chart: IChartApi = createChart(chartDiv, {
    width: chartDiv.clientWidth || 640,
    height: 380,
    layout: {
      background: { color: 'transparent' },
      textColor: dark ? '#d1d5db' : '#374151',
    },
    grid: {
      vertLines: { color: dark ? '#374151' : '#e5e7eb' },
      horzLines: { color: dark ? '#374151' : '#e5e7eb' },
    },
    crosshair: { mode: 1 },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, timeVisible: true },
    handleScroll: false,
    handleScale: false,
  });

  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
  });

  const volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume',
  });

  chart.priceScale('volume').applyOptions({
    scaleMargins: { top: 0.8, bottom: 0 },
  });

  candleSeries.setData(
    data.map(c => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
  );

  volumeSeries.setData(
    data.map(c => ({
      time: c.time as UTCTimestamp,
      value: c.volume,
      color: c.close >= c.open ? '#26a69a60' : '#ef535060',
    }))
  );

  chart.timeScale().fitContent();

  const resizeObserver = new ResizeObserver(() => {
    chart.applyOptions({ width: chartDiv.clientWidth });
  });
  resizeObserver.observe(chartDiv);

  return () => {
    resizeObserver.disconnect();
    chart.remove();
  };
}
