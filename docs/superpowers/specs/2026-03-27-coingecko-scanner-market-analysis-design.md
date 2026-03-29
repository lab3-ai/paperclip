# Design: plugin-coingecko-scanner + skill market-analysis

**Date**: 2026-03-27
**Approach**: MVP First — 1 plugin + 1 skill, đủ để học pattern và chạy được
**Target**: Team BD tại Lab3

---

## Part 1: Plugin `plugin-coingecko-scanner`

### Tổng quan

Plugin scan data crypto từ CoinGecko Free API, lưu vào plugin state, emit events cho các plugin khác (telegram-notifier), và tự tạo issue khi phát hiện biến động lớn.

### Cấu trúc file

```
packages/plugins/examples/plugin-coingecko-scanner/
├── package.json
├── src/
│   ├── manifest.ts           ← Capabilities, job, settings page
│   ├── worker.ts             ← 1 job "scan-coingecko", logic xử lý
│   └── ui/
│       └── index.tsx         ← Config: scan status display
├── tsconfig.json
```

### Manifest

```typescript
{
  id: "lab3-ai.plugin-coingecko-scanner",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "CoinGecko Scanner",
  description: "Scan crypto market data from CoinGecko — prices, trends, volume alerts",
  author: "lab3-ai",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "jobs.schedule",
    "plugin.state.read",
    "plugin.state.write",
    "events.emit",
    "issues.create",
    "activity.log.write",
    "instance.settings.register",
  ],
  instanceConfigSchema: {
    type: "object",
    properties: {
      companyId:              { type: "string", title: "Company ID" },
      scanMode:               { type: "string", title: "Scan Mode", enum: ["top", "trending", "watchlist", "all"], default: "top" },
      watchlistCoinIds:       { type: "string", title: "Watchlist Coin IDs (comma-separated)", default: "bitcoin,ethereum,solana" },
      topCoinsLimit:          { type: "number", title: "Top Coins Limit", default: 20 },
      priceChangeThreshold:   { type: "number", title: "Price Change Alert Threshold (%)", default: 10 },
      volumeChangeThreshold:  { type: "number", title: "Volume Change Alert Threshold (%)", default: 50 },
      currency:               { type: "string", title: "Currency", default: "usd" },
    },
    required: ["companyId"],
  },
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  jobs: [{
    jobKey: "scan-coingecko",
    displayName: "Scan CoinGecko Markets",
    description: "Fetch crypto market data and detect price/volume anomalies",
    schedule: "*/5 * * * *",
  }],
  ui: {
    slots: [{
      type: "settingsPage",
      id: "coingecko-scanner-settings",
      displayName: "CoinGecko Scanner Settings",
      exportName: "CoingeckoScannerSettings",
    }],
  },
}
```

### Settings Page

| Setting | Type | Default | Mô tả |
|---------|------|---------|--------|
| `companyId` | string | — (required) | Company ID để tạo issues |
| `scanMode` | enum | `"top"` | `"top"` / `"trending"` / `"watchlist"` / `"all"` |
| `watchlistCoinIds` | string | `"bitcoin,ethereum,solana"` | Comma-separated CoinGecko coin IDs |
| `topCoinsLimit` | number | `20` | Số coins top market cap |
| `priceChangeThreshold` | number | `10` | % thay đổi giá để trigger alert/issue |
| `volumeChangeThreshold` | number | `50` | % volume spike để trigger |
| `currency` | string | `"usd"` | Đơn vị tiền tệ |

### CoinGecko API Endpoints (Free tier, no API key needed)

| Endpoint | Dùng cho | Khi nào gọi |
|----------|---------|-------------|
| `GET /api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page={limit}` | Top coins: giá, volume, market cap, % change | scanMode = `"top"` hoặc `"all"` |
| `GET /api/v3/search/trending` | Trending coins đang hot | scanMode = `"trending"` hoặc `"all"` |
| `GET /api/v3/simple/price?ids={coinIds}&vs_currencies={currency}&include_24hr_change=true&include_24hr_vol=true` | Watchlist cụ thể | scanMode = `"watchlist"` hoặc `"all"` |

**Rate limit**: Free tier cho phép 10-30 calls/phút. Với scan mỗi 5 phút, mỗi lần gọi tối đa 3 endpoints (mode `"all"`), nằm trong giới hạn an toàn.

### Data Flow

```
┌──────────────┐     ┌───────────────┐     ┌──────────────────┐
│ CoinGecko    │     │ Plugin State  │     │ Events           │
│ Free API     │────▶│ (lưu kết quả │────▶│ "coingecko-scan- │
│              │     │  scan + diff  │     │  complete"        │
│ /coins/      │     │  với lần      │     │                  │
│  markets     │     │  trước)       │     │ "coingecko-      │
│ /search/     │     │               │     │  price-alert"    │
│  trending    │     └───────────────┘     └────────┬─────────┘
└──────────────┘                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │ Nếu threshold    │
                                           │ vượt ngưỡng:     │
                                           │ • Tạo Issue      │
                                           │ • Emit alert     │
                                           │   event          │
                                           └──────────────────┘
```

### Worker Logic

```
Job "scan-coingecko" chạy mỗi lần:

1. Đọc config (companyId, scanMode, thresholds, coin list)
2. Gọi CoinGecko API theo scanMode:
   - "top"       → GET /coins/markets
   - "trending"  → GET /search/trending
   - "watchlist" → GET /simple/price
   - "all"       → gọi cả 3
3. Đọc state cũ: ctx.state.get({ scopeKind: "instance", stateKey: "last-scan" })
4. So sánh với lần scan trước:
   - Tính % thay đổi giá mỗi coin
   - Tính % thay đổi volume mỗi coin
5. Lưu state mới: ctx.state.set({ scopeKind: "instance", stateKey: "last-scan" }, newData)
6. Emit event "coingecko-scan-complete" (luôn luôn, chứa toàn bộ data)
7. Check thresholds cho từng coin:
   - Nếu |priceChange| > priceChangeThreshold HOẶC |volumeChange| > volumeChangeThreshold:
     → Emit "coingecko-price-alert" (chứa coin + lý do)
     → Tạo issue trong company:
       Title: "🔔 {COIN} {+/-X%} trong 24h"
       Description: Chi tiết price, volume, so sánh
       Priority: "high" nếu >20%, "medium" nếu >10%
8. Ghi activity log: "Scanned {N} coins, {M} alerts triggered"
```

### Plugin State Schema

```typescript
// stateKey: "last-scan"
{
  scannedAt: string;          // ISO timestamp
  scanMode: string;
  coins: Array<{
    id: string;               // "bitcoin"
    symbol: string;           // "btc"
    name: string;             // "Bitcoin"
    currentPrice: number;
    priceChange24h: number;   // % change
    volume24h: number;
    volumeChange24h: number;  // % change (so với lần scan trước)
    marketCap: number;
    source: "top" | "trending" | "watchlist";
  }>;
  alertsTriggered: number;
}
```

### Events Emitted

| Event | Khi nào | Payload |
|-------|--------|---------|
| `coingecko-scan-complete` | Mỗi lần scan xong | `{ scannedAt, coinCount, coins: [...] }` |
| `coingecko-price-alert` | Coin vượt threshold | `{ coin, priceChange, volumeChange, reason }` |

### Error Handling

| Lỗi | Xử lý |
|------|--------|
| CoinGecko 429 (rate limit) | Log warning, skip lần này, chờ lần sau |
| API timeout / network error | Log error, không crash worker |
| Config thiếu companyId | Skip tạo issue + skip emit events (cả 2 cần companyId), vẫn scan và lưu state |
| Lần scan đầu (không có state cũ) | Lưu data, không so sánh, không trigger alerts |

---

## Part 2: Skill `market-analysis`

### Tổng quan

Skill markdown (~50 dòng) dạy agent (Market Analyst) cách phân tích crypto market data bằng price action đơn giản. Agent đọc skill này lúc startup và follow quy trình khi checkout task phân tích.

### Cấu trúc file

```
skills/market-analysis/
└── SKILL.md
```

### Nội dung SKILL.md

**Frontmatter:**
```yaml
name: market-analysis
description: Hướng dẫn agent phân tích thị trường crypto bằng price action — so sánh % thay đổi giá, volume, trend tuần
```

**Các phần chính:**

#### 1. Khi nào dùng skill này
- Khi checkout task liên quan phân tích market/crypto
- Khi đọc data từ coingecko-scanner hoặc polymarket-scanner

#### 2. Quy trình phân tích (5 bước)

```
Bước 1: Thu thập data
  → Đọc task comments/documents chứa scan results
  → Đọc memory (para-memory) để lấy data tuần trước nếu có

Bước 2: So sánh % thay đổi
  → Giá 24h: tăng/giảm bao nhiêu %?
  → Volume 24h: spike hay giảm so với trung bình?
  → So với tuần trước: trend đi lên hay xuống?

Bước 3: Xác định tín hiệu
  → 🟢 Bullish: giá tăng >5% + volume tăng >20%
  → 🔴 Bearish: giá giảm >5% + volume tăng (panic sell)
  → 🟡 Neutral: biến động <5%, volume bình thường

Bước 4: Tổng hợp
  → Xếp hạng coins theo mức độ đáng chú ý
  → Highlight top 3 movers

Bước 5: Output
  → Comment lên task theo template bên dưới
  → Nếu có signal 🟢 hoặc 🔴 mạnh → tạo subtask cho Content Writer
  → Lưu vào para-memory để tuần sau so sánh
```

#### 3. Tiêu chí đánh giá

| Signal | Điều kiện | Hành động |
|--------|----------|-----------|
| 🟢 Bullish mạnh | Giá +>10%, volume +>30% | Tạo subtask viết bài |
| 🟢 Bullish nhẹ | Giá +5-10% | Ghi nhận, theo dõi |
| 🟡 Neutral | Biến động <5% | Ghi nhận |
| 🔴 Bearish nhẹ | Giá -5-10% | Ghi nhận, theo dõi |
| 🔴 Bearish mạnh | Giá ->10%, volume +>30% | Tạo subtask viết bài cảnh báo |

#### 4. Template Output

```markdown
## Market Analysis - [Ngày]

### Top Movers (24h)
| Coin | Giá | 24h % | Volume % | Signal |
|------|-----|-------|----------|--------|
| ...  | ... | ...   | ...      | 🟢/🔴/🟡 |

### Tín hiệu đáng chú ý
- [Coin]: [Lý do] — [Hành động đề xuất]

### So với tuần trước
- Trend chung: [Bullish/Bearish/Sideways]
- Điểm khác biệt: [...]

### Đề xuất
- [ ] Viết bài về [topic] (nếu có signal mạnh)
```

### Mối liên hệ Plugin ↔ Skill

```
Plugin coingecko-scanner          Skill market-analysis
┌─────────────────────┐          ┌─────────────────────┐
│ Scan data tự động   │          │ Dạy agent cách      │
│ Lưu vào state       │────▶     │ đọc data từ plugin  │
│ Emit events         │          │ So sánh % change     │
│ Tạo issue nếu alert │          │ Phân loại tín hiệu  │
│                     │          │ Output theo template │
└─────────────────────┘          └─────────────────────┘
     (code tự chạy)                 (kiến thức cho AI)
```

Plugin cung cấp **data thô + alerts tự động**. Skill dạy agent **cách phân tích sâu hơn và viết báo cáo** khi được giao task.

---

## Testing

### Plugin test
1. Install plugin vào Paperclip: UI → Plugin Manager → Install
2. Cấu hình settings: companyId, scanMode = "top", thresholds
3. Trigger job thủ công hoặc đợi cron
4. Verify: plugin state có data, events được emit, issues tạo khi threshold vượt

### Skill test
1. Import skill vào company: `POST /api/companies/:companyId/skills/import`
2. Assign skill cho Market Analyst agent
3. Tạo task "Phân tích thị trường hôm nay" assign cho agent
4. Verify: agent output theo đúng template, có tín hiệu đúng format
