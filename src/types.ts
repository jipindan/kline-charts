export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type OhlcField = 'open' | 'high' | 'low' | 'close';

export interface EntryAnnotation {
  type: 'entry';
  date: string;
  price: number;
  label?: string;
}

export interface TrendlineAnnotation {
  type: 'trendline';
  from: [string, OhlcField];
  to: [string, OhlcField];
  color?: string;
  extend?: boolean;
}

export interface PositionAnnotation {
  type: 'position';
  entry_date: string;
  exit_date: string;
  entry: number;
  sl: number;
  tp: number;
  label?: string;
}

export type Annotation = EntryAnnotation | TrendlineAnnotation | PositionAnnotation;

export type DataProvider = 'binance' | 'yahoo';
export type ColorStyle = 'international' | 'cn';

export interface IndicatorDef {
  ma?: number;
  ema?: number;
  color?: string;
}

export interface KlineConfig {
  symbol: string;
  provider?: DataProvider;
  interval?: string;
  from?: string;
  to?: string;
  annotations?: Annotation[];
  data?: (number[])[];
  height?: number;
  volume?: boolean;
  color?: ColorStyle;
  indicators?: IndicatorDef[];
  compare?: string[];
}

export interface CompareLine {
  symbol: string;
  color: string;
  pctValues: (number | null)[];
}

export interface RenderOptions {
  chartHeight: number;
  showVolume: boolean;
  colorStyle: ColorStyle;
}

export interface KlinePluginSettings {
  chartHeight: number;
  showVolume: boolean;
  colorStyle: ColorStyle;
}

export const DEFAULT_SETTINGS: KlinePluginSettings = {
  chartHeight: 380,
  showVolume: true,
  colorStyle: 'international',
};
