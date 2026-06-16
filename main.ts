import { Plugin, MarkdownRenderChild } from 'obsidian';
import { parseKlineConfig, configToCandles } from './src/parser';
import { renderKlineChart, renderNoData, renderError } from './src/renderer';

export default class KlineChartsPlugin extends Plugin {
  async onload() {
    console.log('kline-charts: loaded');

    this.registerMarkdownCodeBlockProcessor('kline', (source, el, ctx) => {
      const child = new KlineRenderChild(el, source);
      ctx.addChild(child);
      child.render();
    });
  }

  async onunload() {
    console.log('kline-charts: unloaded');
  }
}

class KlineRenderChild extends MarkdownRenderChild {
  private cleanup: (() => void) | null = null;
  private source: string;

  constructor(containerEl: HTMLElement, source: string) {
    super(containerEl);
    this.source = source;
  }

  render() {
    try {
      const config = parseKlineConfig(this.source);
      if (config.data && config.data.length > 0) {
        const candles = configToCandles(config);
        this.cleanup = renderKlineChart(this.containerEl, candles);
      } else {
        renderNoData(this.containerEl, config);
      }
    } catch (e) {
      renderError(this.containerEl, (e as Error).message);
    }
  }

  onunload() {
    this.cleanup?.();
    this.cleanup = null;
  }
}
