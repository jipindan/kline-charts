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

---

## 2026-06-16 · 换渲染库 + P2 标注

**换渲染库**
- 移除 lightweight-charts（TradingView 水印、scroll/scale bug）
- 改为纯 Canvas 自绘：零外部图表依赖，bundle 237KB → 106KB
- 修复时间戳被遮问题（自控 PAD.bottom）；图表完全静态无交互

**P2 标注**
- `entry`：琥珀色上三角 + label，定位到 `[date, price]`
- `trendline`：紫色连线，端点为 `[date, ohlcField]`（从 data 查实际价格），两端标点
- `sl/tp`：红/绿虚线横贯全图，左上角显示 label + 价格
- 所有标注 clip 到 price area，不溢出到 volume 区
- date 匹配用 UTC day key，避免时区导致匹配不上

---

## 2026-06-16 · P2 标注完成

**做了什么**
- 新增 `position` 标注类型：TradingView 风格 TP/SL 半透明方框，绿色盈利区 + 红色亏损区，从入场蜡烛中心到出场蜡烛中心
- 废弃独立的 `sl` / `tp` 类型，合并进 `position`（含 entry/sl/tp/entry_date/exit_date）
- `entry` 标注：琥珀色上三角 + label
- `trendline` 标注：蓝色连线（`#60a5fa`），端点用 `[date, high/low/open/close]` 查 K 线实际价格，无圆点
- 方框无边框、无 entry 虚线，干净
- 标注画在 K 线下层，不遮蜡烛
- 价格范围自动扩展以包含 position 的 TP/SL 价格

**视觉迭代**
- 方框去掉 strokeRect 边框
- 去掉 entry 黄色虚线（方框本身表达入场位）
- trendline 紫色 → 蓝色
- 方框 X 轴对齐蜡烛中心线（wick）而非 slot 边缘

**格式变更**
```yaml
# 旧（已废弃）
- type: sl
  price: 41000
- type: tp
  price: 47000

# 新
- type: position
  entry_date: 2024-01-12
  exit_date: 2024-01-18
  entry: 45675
  sl: 41000
  tp: 47000
  label: "突破入场"
```

**待做**
- P3：Settings + Binance provider + Fetch 按钮 + 写回代码块
- P4：Alpha Vantage + i18n + 深浅色主题 + 报错 UX
- P5：README/LICENSE + 上架合规 + 社区 PR
- P3：Settings + Binance/AV provider + Fetch 按钮 + 写回代码块
- P4：Alpha Vantage + i18n + 深浅色主题 + 报错 UX
- P5：README/LICENSE + 上架合规 + 社区 PR
