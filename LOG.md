# kline-charts LOG

**定位：** Obsidian 插件，用代码块渲染 K 线图 + 交易标注（入场点、趋势线、止损止盈），目标上架 Obsidian 社区市场。
**车道：** Lane4（代码·收入）

---

## 2026-06-16 · P0 脚手架完成

**做了什么**
- 创建项目目录 `kline-charts/`，搭建完整构建链（TypeScript + esbuild）
- 安装依赖：lightweight-charts v5.2.0、js-yaml、obsidian types
- 实现 P0 版本：`kline` 代码块处理器 → 渲染 20 根硬编码 BTC/USDT 日K（Jan 2024）+ 成交量柱
- 部署到测试库 `.obsidian/plugins/kline-charts/`，构建产物 237KB

**技术决策**
- lightweight-charts v5.2.0（`addSeries(CandlestickSeries, opts)` API）
- 代码块 id: `kline`，插件 id: `kline-charts`，`isDesktopOnly: true`
- `MarkdownRenderChild` 包裹，`onunload` 清理 chart 实例
- `ResizeObserver` 处理容器宽度变化

---

## 2026-06-16 · P1 YAML 解析 + 内联 data 渲染

**做了什么**
- 新增 `src/parser.ts`：js-yaml 解析代码块 → `KlineConfig`，`configToCandles()` 把 `data` 数组转 `Candle[]`，含行级校验和友好报错
- 更新 `src/renderer.ts`：移除硬编码数据；新增 `renderError()`、`renderNoData()` 两个状态函数；`renderKlineChart()` 改为接受必填 `candles` 参数
- 更新 `main.ts`：解析 YAML → 按 data 有无分发到 render / noData / error 三路

**三态逻辑**
- 有 `data` → 渲染 K 线图
- 无 `data`（只写了 symbol/range）→ 占位符（"No data — Fetch coming soon"）
- YAML 出错 / 缺 symbol → 红色报错块

**代码块格式（P1 起生效）**
```yaml
symbol: BTCUSDT
interval: 1d
from: 2024-01-01
to: 2024-01-20
data:
  - [1704067200, 42626, 44706, 42588, 44186, 48123]
  - ...
```

**待做**
- P2：标注渲染（entry / trendline / sl / tp）
- P3：Settings + Binance/AV provider + Fetch 按钮 + 写回代码块
- P4：Alpha Vantage + i18n + 深浅色主题 + 报错 UX
- P5：README/LICENSE + 上架合规 + 社区 PR
