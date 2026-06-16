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
        .addOption('binance', 'Binance')
        .addOption('alphavantage', 'Alpha Vantage (coming soon)')
        .setValue(this.plugin.settings.defaultProvider)
        .onChange(async (v) => {
          this.plugin.settings.defaultProvider = v as any;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.defaultProvider === 'alphavantage') {
      new Setting(containerEl)
        .setName('Alpha Vantage API key')
        .addText(text => text
          .setPlaceholder('Enter API key')
          .setValue(this.plugin.settings.alphaVantageKey)
          .onChange(async (v) => {
            this.plugin.settings.alphaVantageKey = v;
            await this.plugin.saveSettings();
          })
        );
    }

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
  }
}
