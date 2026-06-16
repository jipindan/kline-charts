import { Plugin, MarkdownRenderChild, MarkdownPostProcessorContext, TFile } from 'obsidian';
import { parseKlineConfig, configToCandles } from './src/parser';
import { renderKlineChart, renderNoData, renderLoading, renderError } from './src/renderer';
import { fetchBinanceKlines } from './src/binance';
import { fetchYahooKlines } from './src/yahoo';
import { KlineSettingTab } from './src/settings';
import { KlinePluginSettings, KlineConfig, RenderOptions, DEFAULT_SETTINGS } from './src/types';

export default class KlineChartsPlugin extends Plugin {
  settings: KlinePluginSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new KlineSettingTab(this));

    this.registerMarkdownCodeBlockProcessor('kline', (source, el, ctx) => {
      const child = new KlineRenderChild(el, source, this, ctx);
      ctx.addChild(child);
      child.render();
    });
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

  private get renderOptions(): RenderOptions {
    const s = this.plugin.settings;
    return { chartHeight: s.chartHeight, showVolume: s.showVolume, colorStyle: s.colorStyle };
  }

  render() {
    try {
      const config = parseKlineConfig(this.source);
      if (config.data && config.data.length > 0) {
        const candles = configToCandles(config);
        this.cleanup = renderKlineChart(this.containerEl, candles, config.annotations, this.renderOptions);
      } else {
        renderNoData(this.containerEl, config, this.plugin.settings, () => this.fetchAndWriteBack(config));
      }
    } catch (e) {
      renderError(this.containerEl, (e as Error).message);
    }
  }

  private async fetchAndWriteBack(config: KlineConfig) {
    const provider = config.provider ?? this.plugin.settings.defaultProvider;
    const interval = config.interval ?? this.plugin.settings.defaultInterval;

    renderLoading(this.containerEl, config);

    try {
      let data: number[][];
      if (provider === 'binance') {
        data = await fetchBinanceKlines(config.symbol, interval, config.from, config.to);
      } else {
        data = await fetchYahooKlines(config.symbol, interval, config.from, config.to);
      }
      await this.writeBack(data);
    } catch (e) {
      renderError(this.containerEl, (e as Error).message, () => this.fetchAndWriteBack(config));
    }
  }

  private async writeBack(data: number[][]) {
    const info = this.ctx.getSectionInfo(this.containerEl);
    if (!info) {
      renderError(this.containerEl, 'Cannot locate code block in source');
      return;
    }

    const file = this.plugin.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
    if (!file || !(file instanceof TFile)) {
      renderError(this.containerEl, 'Source file not found');
      return;
    }

    const { lineStart, lineEnd } = info;

    await this.plugin.app.vault.process(file, (content) => {
      const lines = content.split('\n');
      const codeLines = lines.slice(lineStart + 1, lineEnd);
      const newSource = appendData(codeLines.join('\n'), data);
      return [
        ...lines.slice(0, lineStart + 1),
        ...newSource.split('\n'),
        ...lines.slice(lineEnd),
      ].join('\n');
    });
  }

  onunload() {
    this.cleanup?.();
    this.cleanup = null;
  }
}

function appendData(source: string, data: number[][]): string {
  const lines = source.split('\n');
  const idx = lines.findIndex(l => /^data:/.test(l));
  const header = idx >= 0 ? lines.slice(0, idx) : [...lines];
  while (header.length > 0 && header[header.length - 1].trim() === '') header.pop();
  const dataLines = ['data:'];
  for (const row of data) {
    dataLines.push(`  - [${row.join(', ')}]`);
  }
  return [...header, ...dataLines].join('\n');
}
