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

    new Setting(containerEl)
      .setName('Default data provider')
      .setDesc('Data source for fetching K-line data')
      .addDropdown(dd => dd
        .addOption('binance', 'Binance (crypto)')
        .addOption('yahoo', 'Yahoo Finance (stocks / ETF / forex / crypto)')
        .setValue(this.plugin.settings.defaultProvider)
        .onChange(async (v) => {
          this.plugin.settings.defaultProvider = v as any;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Default interval')
      .setDesc('Used when interval is not specified in the code block')
      .addDropdown(dd => dd
        .addOption('1d', '1 Day')
        .addOption('4h', '4 Hours')
        .addOption('1h', '1 Hour')
        .addOption('15m', '15 Minutes')
        .addOption('1w', '1 Week')
        .addOption('1M', '1 Month')
        .setValue(this.plugin.settings.defaultInterval)
        .onChange(async (v) => {
          this.plugin.settings.defaultInterval = v;
          await this.plugin.saveSettings();
        })
      );

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
