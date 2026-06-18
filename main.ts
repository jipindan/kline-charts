import { Plugin, MarkdownRenderChild, MarkdownPostProcessorContext, TFile } from 'obsidian';
import { parseKlineConfig, configToCandles, appendData } from './src/parser';
import { renderKlineChart, renderNoData, renderLoading, renderError, renderTruncationNotice } from './src/renderer';
import { getProvider } from './src/providers';
import { KlineSettingTab } from './src/settings';
import { KlinePluginSettings, KlineConfig, RenderOptions, DEFAULT_SETTINGS, CompareLine } from './src/types';
import { buildCompareLines } from './src/compare';

const CACHE_TTL = 10 * 60 * 1000;

interface CacheEntry {
  data: number[][];
  fetchedAt: number;
}

export default class KlineChartsPlugin extends Plugin {
  settings: KlinePluginSettings = DEFAULT_SETTINGS;
  dataCache = new Map<string, CacheEntry>();

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new KlineSettingTab(this));

    this.registerMarkdownCodeBlockProcessor('kline', (source, el, ctx) => {
      const child = new KlineRenderChild(el, source, this, ctx);
      ctx.addChild(child);
      child.render();
    });
  }

  onunload() {
    this.dataCache.clear();
  }

  getCached(key: string): number[][] | null {
    const entry = this.dataCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL) {
      this.dataCache.delete(key);
      return null;
    }
    return entry.data;
  }

  setCache(key: string, data: number[][]) {
    this.dataCache.set(key, { data, fetchedAt: Date.now() });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class KlineRenderChild extends MarkdownRenderChild {
  private cleanup: (() => void) | null = null;
  private source: string;
  private plugin: KlineChartsPlugin;
  private ctx: MarkdownPostProcessorContext;
  private isFetching = false;

  constructor(
    containerEl: HTMLElement,
    source: string,
    plugin: KlineChartsPlugin,
    ctx: MarkdownPostProcessorContext,
  ) {
    super(containerEl);
    this.source = source;
    this.plugin = plugin;
    this.ctx = ctx;
  }

  private getRenderOptions(config: KlineConfig): RenderOptions {
    const s = this.plugin.settings;
    return {
      chartHeight: config.height ?? s.chartHeight,
      showVolume:  config.volume ?? s.showVolume,
      colorStyle:  config.color ?? s.colorStyle,
    };
  }

  render() {
    try {
      const config = parseKlineConfig(this.source);
      if (config.data && config.data.length > 0) {
        const { candles, truncated } = configToCandles(config);
        this.cleanup = renderKlineChart(
          this.containerEl, candles, config.annotations,
          this.getRenderOptions(config), config.indicators,
          undefined, config.symbol,
          (annotationYaml) => this.appendAnnotation(annotationYaml),
        );
        if (truncated) renderTruncationNotice(this.containerEl);
        if (config.compare && config.compare.length > 0) {
          this.fetchCompareData(config, candles);
        }
      } else {
        renderNoData(this.containerEl, config, this.plugin.settings, () => this.fetchAndWriteBack(config));
      }
    } catch (e) {
      renderError(this.containerEl, (e as Error).message);
    }
  }

  private async fetchCompareData(config: KlineConfig, mainCandles: import('./src/types').Candle[]) {
    if (!config.compare || config.compare.length === 0) return;

    const provider = config.provider ?? this.plugin.settings.defaultProvider;
    const interval = config.interval ?? this.plugin.settings.defaultInterval;
    const compareData = new Map<string, number[][]>();

    const fetches = config.compare.map(async (symbol) => {
      const cacheKey = `${provider}:${symbol}:${interval}:${config.from ?? ''}:${config.to ?? ''}`;
      try {
        const cached = this.plugin.getCached(cacheKey);
        const data = cached ?? await getProvider(provider).fetch(symbol, interval, config.from, config.to);
        if (!cached) this.plugin.setCache(cacheKey, data);
        compareData.set(symbol, data);
      } catch {
        // silently skip failed compare symbols
      }
    });

    await Promise.all(fetches);

    if (compareData.size > 0) {
      const lines = buildCompareLines(mainCandles, compareData);
      const { candles, truncated: _ } = configToCandles(config);
      this.cleanup?.();
      this.cleanup = renderKlineChart(
        this.containerEl, candles, config.annotations,
        this.getRenderOptions(config), config.indicators,
        lines, config.symbol,
        (annotationYaml) => this.appendAnnotation(annotationYaml),
      );
    }
  }

  private async fetchAndWriteBack(config: KlineConfig) {
    if (this.isFetching) return;
    this.isFetching = true;

    const provider = config.provider ?? this.plugin.settings.defaultProvider;
    const interval = config.interval ?? this.plugin.settings.defaultInterval;
    const cacheKey = `${provider}:${config.symbol}:${interval}:${config.from ?? ''}:${config.to ?? ''}`;

    renderLoading(this.containerEl, config);

    try {
      const cached = this.plugin.getCached(cacheKey);
      const data = cached ?? await getProvider(provider).fetch(config.symbol, interval, config.from, config.to);
      if (!cached) this.plugin.setCache(cacheKey, data);
      await this.writeBack(data);
    } catch (e) {
      renderError(this.containerEl, (e as Error).message, () => this.fetchAndWriteBack(config));
    } finally {
      this.isFetching = false;
    }
  }

  private async writeBack(data: number[][]) {
    const file = this.plugin.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
    if (!file || !(file instanceof TFile)) {
      renderError(this.containerEl, 'Source file not found');
      return;
    }

    const originalSource = this.source;

    await this.plugin.app.vault.process(file, (content) => {
      const lines = content.split('\n');
      const block = findKlineBlock(lines, originalSource);
      if (!block) {
        throw new Error('Code block moved or deleted');
      }
      const codeLines = lines.slice(block.start + 1, block.end);
      const newSource = appendData(codeLines.join('\n'), data);
      return [
        ...lines.slice(0, block.start + 1),
        ...newSource.split('\n'),
        ...lines.slice(block.end),
      ].join('\n');
    });
  }

  private async appendAnnotation(annotationYaml: string) {
    const file = this.plugin.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
    if (!file || !(file instanceof TFile)) return;

    const originalSource = this.source;

    try {
      await this.plugin.app.vault.process(file, (content) => {
        const lines = content.split('\n');
        const block = findKlineBlock(lines, originalSource);
        if (!block) throw new Error('Code block moved or deleted');

        const codeLines = lines.slice(block.start + 1, block.end);
        const annIdx = codeLines.findIndex(l => /^annotations:/.test(l));

        let insertLines: string[];
        if (annIdx >= 0) {
          let insertAt = annIdx + 1;
          while (insertAt < codeLines.length && /^\s/.test(codeLines[insertAt])) insertAt++;
          codeLines.splice(insertAt, 0, ...annotationYaml.split('\n'));
          insertLines = codeLines;
        } else {
          const dataIdx = codeLines.findIndex(l => /^data:/.test(l));
          const insertAt = dataIdx >= 0 ? dataIdx : codeLines.length;
          codeLines.splice(insertAt, 0, 'annotations:', ...annotationYaml.split('\n'));
          insertLines = codeLines;
        }

        return [
          ...lines.slice(0, block.start + 1),
          ...insertLines,
          ...lines.slice(block.end),
        ].join('\n');
      });
    } catch {
      // silently fail — annotation write-back is best-effort
    }
  }

  onunload() {
    this.cleanup?.();
    this.cleanup = null;
  }
}

function findKlineBlock(lines: string[], originalSource: string): { start: number; end: number } | null {
  const trimmed = originalSource.trim();
  for (let i = 0; i < lines.length; i++) {
    if (!/^```kline\s*$/.test(lines[i])) continue;
    let end = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^```\s*$/.test(lines[j])) { end = j; break; }
    }
    if (end === -1) continue;
    const inner = lines.slice(i + 1, end).join('\n');
    if (inner.trim() === trimmed) return { start: i, end };
  }
  return null;
}

