import { Plugin, MarkdownRenderChild } from 'obsidian';
import { renderKlineChart } from './src/renderer';

export default class KlineChartsPlugin extends Plugin {
  async onload() {
    console.log('kline-charts: loaded');

    this.registerMarkdownCodeBlockProcessor('kline', (source, el, ctx) => {
      const child = new KlineRenderChild(el);
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

  constructor(containerEl: HTMLElement) {
    super(containerEl);
  }

  render() {
    this.cleanup = renderKlineChart(this.containerEl);
  }

  onunload() {
    this.cleanup?.();
    this.cleanup = null;
  }
}
