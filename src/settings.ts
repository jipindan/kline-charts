import { PluginSettingTab, Setting } from 'obsidian';
import type KlineChartsPlugin from '../main';

export class KlineSettingTab extends PluginSettingTab {
  plugin: KlineChartsPlugin;

  constructor(plugin: KlineChartsPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Kline Charts' });
    containerEl.createEl('p', {
      text: 'Use provider: binance (crypto) or provider: yahoo (stocks / ETF / forex / crypto) in your code blocks. No API key needed — both use public data.',
      cls: 'kline-settings-hint',
    });

    new Setting(containerEl)
      .setName('Chart height')
      .setDesc(`${this.plugin.settings.chartHeight}px`)
      .addSlider(sl => sl
        .setLimits(200, 600, 20)
        .setValue(this.plugin.settings.chartHeight)
        .onChange(async (v) => {
          this.plugin.settings.chartHeight = v;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName('Show volume')
      .setDesc('Display volume bars below the chart')
      .addToggle(tg => tg
        .setValue(this.plugin.settings.showVolume)
        .onChange(async (v) => {
          this.plugin.settings.showVolume = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Color style')
      .setDesc('Candlestick color convention')
      .addDropdown(dd => dd
        .addOption('international', 'International (green up, red down)')
        .addOption('cn', 'CN (red up, green down)')
        .setValue(this.plugin.settings.colorStyle)
        .onChange(async (v) => {
          this.plugin.settings.colorStyle = v as any;
          await this.plugin.saveSettings();
        })
      );
  }
}
