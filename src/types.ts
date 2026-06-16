export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type OhlcField = 'open' | 'high' | 'low' | 'close';

export type AnnotationType = 'entry' | 'trendline' | 'sl' | 'tp';

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
}

export interface SlAnnotation {
  type: 'sl';
  price: number;
  label?: string;
}

export interface TpAnnotation {
  type: 'tp';
  price: number;
  label?: string;
}

export type Annotation = EntryAnnotation | TrendlineAnnotation | SlAnnotation | TpAnnotation;

export type DataProvider = 'binance' | 'alphavantage';

export interface KlineConfig {
  symbol: string;
  provider?: DataProvider;
  interval?: string;
  from?: string;
  to?: string;
  annotations?: Annotation[];
  data?: (number[])[];
}

export interface KlinePluginSettings {
  defaultProvider: DataProvider;
  alphaVantageKey: string;
  defaultInterval: string;
  language: 'auto' | 'en' | 'zh';
}

export const DEFAULT_SETTINGS: KlinePluginSettings = {
  defaultProvider: 'binance',
  alphaVantageKey: '',
  defaultInterval: '1d',
  language: 'auto',
};
