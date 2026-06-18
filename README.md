# Kline Charts

Render candlestick K-line charts with trade annotations directly in your Obsidian notes.

![demo](https://raw.githubusercontent.com/junyixia/kline-charts/main/demo.png)

## Features

- **Pure Canvas rendering** — no external charting libraries, 138KB bundle
- **Binance & Yahoo Finance** — fetch crypto, stocks, ETFs, forex, indices
- **One-click fetch** — click "Fetch Data", data writes back to the code block
- **Hover crosshair + tooltip** — OHLCV data and change % on mouse hover
- **Trade annotations** — entry points, trendlines, TP/SL position boxes
- **Draw trendlines** — click the pencil icon, draw on the chart, auto-saved to YAML
- **MA / EMA indicators** — overlay moving average lines with custom periods and colors
- **Multi-symbol compare** — overlay normalized % change lines for multiple symbols
- **Per-block settings** — override height, volume, color style per code block
- **CN / International color styles** — red-up or green-up, your choice
- **Configurable** — chart height, volume toggle, default provider & interval
- **Data caching** — 10-minute cache avoids redundant API calls
- **Mobile support** — works on both desktop and mobile Obsidian

## Usage

Create a `kline` code block in your note:

````markdown
```kline
symbol: BTCUSDT
interval: 1d
from: 2024-01-01
to: 2024-01-31
```
````

Click **Fetch Data** to pull data from Binance. The data is written back into the code block and the chart renders automatically.

### Yahoo Finance (stocks, ETFs, indices)

> **Note:** Yahoo Finance uses an unofficial API that may be rate-limited or discontinued without notice. If fetching fails, try again later or switch to Binance for crypto symbols.

````markdown
```kline
symbol: AAPL
provider: yahoo
interval: 1d
from: 2024-01-01
to: 2024-06-30
```
````

### Annotations

````markdown
```kline
symbol: BTCUSDT
interval: 1d
from: 2024-01-01
to: 2024-01-20
annotations:
  - type: entry
    date: 2024-01-12
    price: 45675
    label: "Breakout"
  - type: trendline
    from: [2024-01-03, low]
    to: [2024-01-10, low]
  - type: position
    entry_date: 2024-01-12
    exit_date: 2024-01-18
    entry: 45675
    sl: 41000
    tp: 47000
    label: "Long"
data:
  - [1704067200, 42626, 44706, 42588, 44186, 48123]
  ...
```
````

**Annotation types:**

| Type | Description |
|------|-------------|
| `entry` | Amber triangle marker at `[date, price]` |
| `trendline` | Line connecting two `[date, ohlcField]` points |
| `position` | TP/SL boxes from entry to exit date |

You can also draw trendlines directly on the chart — hover to reveal the pencil icon, click to enter drawing mode, then click two points on the chart. The annotation is automatically saved to the code block.

### Indicators

````markdown
```kline
symbol: BTCUSDT
interval: 1d
from: 2024-01-01
to: 2024-01-31
indicators:
  - ma: 20
  - ema: 50
    color: "#f59e0b"
```
````

### Multi-symbol Compare

````markdown
```kline
symbol: BTCUSDT
interval: 1d
from: 2024-01-01
to: 2024-06-30
compare: [ETHUSDT, SOLUSDT]
```
````

Overlays normalized percentage change lines for all symbols on the same chart.

### Per-block Settings

Override global settings for individual code blocks:

```yaml
height: 500
volume: false
color: cn
```

## Settings

| Option | Default | Description |
|--------|---------|-------------|
| Default provider | Binance | Binance (crypto) or Yahoo Finance (stocks/ETF/forex) |
| Default interval | 1d | Fallback when not specified in code block |
| Chart height | 380px | 200–600px slider |
| Show volume | On | Toggle volume bars |
| Color style | International | Green-up/red-down or CN red-up/green-down |

## Symbol formats

| Provider | Examples |
|----------|----------|
| Binance | `BTCUSDT`, `ETHUSDT`, `SOLUSDT` |
| Yahoo Finance | `AAPL`, `MSFT`, `^SPX`, `^HSI`, `EURUSD=X`, `BTC-USD` |

## Installation

### From Obsidian Community Plugins

Search for "Kline Charts" in Settings → Community plugins → Browse.

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the latest release
2. Create `<vault>/.obsidian/plugins/kline-charts/`
3. Copy the three files into that folder
4. Enable the plugin in Settings → Community plugins

## License

[MIT](LICENSE)
