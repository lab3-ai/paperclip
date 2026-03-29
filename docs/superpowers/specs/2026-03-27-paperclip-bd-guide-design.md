# Paperclip BD Team Guide — Hiểu toàn bộ dự án và cách sử dụng

**Date**: 2026-03-27
**Target audience**: Team BD (Business Development) tại Lab3
**Use cases**: (A) Scan thị trường crypto/Polymarket/social media, (B) Quản lý content
**Skill level**: Biết code cơ bản, dùng AI hỗ trợ (Claude Code, Cursor...)
**Status**: Mỗi người chạy local riêng, chưa có company chung

---

## Bức tranh tổng thể

Paperclip là **control plane cho AI-agent companies** — nơi bạn tổ chức, điều phối, và giám sát các AI agents làm việc như nhân viên trong 1 công ty.

### Ví dụ End-to-End: Team Lab3 BD

```
┌─────────────────────────────────────────────────────────────┐
│                 COMPANY: "Lab3 BD Team"                     │
│  Goal: "Scan thị trường crypto & tạo content chất lượng"    │
│  Budget: $500/tháng                                         │
│                                                             │
│  ┌─────────────┐                                            │
│  │  CEO Agent  │ ← Nhận goal, phân task cho team            │
│  │ (Claude)    │                                            │
│  └──────┬──────┘                                            │
│         │                                                   │
│    ┌────┴─────────────────┐                                 │
│    │                      │                                 │
│  ┌─▼──────────┐   ┌──────▼───────┐                         │
│  │ Market     │   │ Content      │                          │
│  │ Analyst    │   │ Writer       │                          │
│  │ (Claude)   │   │ (Claude)     │                          │
│  └─────┬──────┘   └──────┬───────┘                          │
│        │                 │                                  │
│  Uses Plugins:     Uses Plugins:                            │
│  • Polymarket      • X Scanner (đọc trend)                  │
│  • X Scanner       • Telegram Notifier                      │
│  • Telegram          (đăng content)                         │
│    Notifier                                                 │
│                                                             │
│  Skills loaded:    Skills loaded:                            │
│  • paperclip       • paperclip                              │
│  • para-memory     • para-memory                            │
└─────────────────────────────────────────────────────────────┘
```

**Luồng chạy thực tế:**

1. Board (bạn) tạo Company "Lab3 BD Team" với goal và budget
2. Tạo CEO Agent → CEO nhận goal, tạo subtask cho team
3. **Market Analyst** thức dậy (heartbeat) → checkout task "Scan Polymarket hôm nay" → Plugin Polymarket Scanner chạy job scan → Agent phân tích kết quả → Comment lên task → Gửi alert qua Telegram Notifier
4. **Content Writer** thức dậy → checkout task "Viết bài tổng hợp thị trường tuần" → Đọc data từ Market Analyst (qua comments/documents) → Viết content → Post qua plugin

---

## Câu 1: Khi nào nên tạo Company?

**Company = 1 đơn vị tổ chức có mục tiêu chung + ngân sách riêng.**

Mỗi company có: Goals (mục tiêu — là entity riêng, liên kết với company), Agents (org chart), Budget, Projects, Tasks.

| Tình huống | Tạo Company? | Ví dụ |
|------------|-------------|-------|
| Team BD muốn chạy chung 1 mục tiêu | **Tạo 1 company** | "Lab3 BD Team" — scan market + content |
| 2 team khác nhau, budget riêng | **Tạo 2 company** | "Lab3 BD" vs "Lab3 Engineering" |
| 1 người thử nghiệm cá nhân | **Tạo 1 company riêng** | "Vuong's Sandbox" — test plugin |
| Muốn tách môi trường dev/prod | **Tạo 2 company** | "Lab3 BD - Dev" vs "Lab3 BD - Prod" |

**Ví dụ cụ thể cho team:**

```
Phương án A — 2 company tách biệt:
  Company 1: "Lab3 BD - Market Intelligence"
    Goal: "Scan & phân tích thị trường crypto, Polymarket, social media"
    Budget: $300/tháng

  Company 2: "Lab3 BD - Content Factory"
    Goal: "Tạo & phân phối content chất lượng dựa trên market data"
    Budget: $200/tháng

Phương án B — 1 company gộp (khuyến nghị cho team nhỏ):
  Company: "Lab3 BD"
    Goal: "Scan thị trường + tạo content tự động để tăng trưởng"
    Budget: $500/tháng
```

**Quy tắc đơn giản**: Cần **budget riêng** hoặc **agent không nên thấy data của nhau** → tách company. Nếu không → gộp 1 company.

---

## Câu 2: Khi nào nên tạo Agent? Có các loại Agent nào?

### Agent là gì?

**Agent = 1 nhân viên AI trong company.** Mỗi agent có:
- **Role**: Vai trò (CEO, Analyst, Writer...)
- **Adapter**: Chạy bằng AI tool nào (Claude, Gemini, Cursor...)
- **Capabilities**: Mô tả agent biết làm gì
- **Budget**: Giới hạn chi tiêu riêng/tháng
- **Reports to**: Báo cáo cho ai (tạo org chart)

### Khi nào nên tạo Agent?

| Tình huống | Tạo Agent? | Ví dụ |
|------------|-----------|-------|
| Cần 1 vai trò chuyên biệt lặp đi lặp lại | **Tạo agent** | "Market Analyst" — scan mỗi ngày |
| Cần phân công & theo dõi công việc tự động | **Tạo agent** | "CEO" — nhận goal, chia task |
| Chỉ chạy 1 lần, không cần theo dõi | **Không cần** | Dùng AI trực tiếp |
| Muốn agent A giao việc cho agent B | **Tạo cả 2** | CEO → delegate cho Analyst |

### 7 Loại Adapter (cách agent chạy)

| Adapter | AI Tool | Khi nào dùng | Phù hợp cho BD? |
|---------|---------|-------------|-----------------|
| **claude-local** | Claude Code (CLI) | Agent cần code, phân tích, viết content | ✅ Rất phù hợp |
| **gemini-local** | Google Gemini | Agent cần Gemini (free tier, Google ecosystem) | ✅ Phù hợp |
| **codex-local** | OpenAI Codex | Agent cần OpenAI ecosystem | ⚠️ Tuỳ nhu cầu |
| **cursor-local** | Cursor IDE | Agent cần edit code trong IDE | ⚠️ Cho dev hơn |
| **opencode-local** | Opencode | Agent dùng Opencode | ⚠️ Cho dev hơn |
| **pi-local** | Pi | Agent dùng Pi | ⚠️ Ít dùng |
| **openclaw-gateway** | OpenClaw (remote) | Agent chạy trên cloud, không cần local | ✅ Cho production |

**Cho team BD, dùng chủ yếu: `claude-local` hoặc `gemini-local`.**

### Ví dụ Org Chart cho Lab3 BD

```
                    ┌──────────────────┐
                    │    CEO Agent     │
                    │ adapter: claude  │
                    │ role: "Điều phối │
                    │  & phân task"    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
   ┌──────────▼───┐  ┌──────▼──────┐  ┌───▼───────────┐
   │ Market       │  │ Content     │  │ Social Media  │
   │ Analyst      │  │ Writer      │  │ Manager       │
   │ adapter:     │  │ adapter:    │  │ adapter:      │
   │ claude       │  │ claude      │  │ gemini        │
   │              │  │             │  │               │
   │ Scan Poly-   │  │ Viết bài    │  │ Theo dõi      │
   │ market, X,   │  │ tổng hợp,   │  │ engagement,   │
   │ crypto news  │  │ thread X    │  │ reply, DM     │
   └──────────────┘  └─────────────┘  └───────────────┘
```

### Agent hoạt động như nào? (Heartbeat)

Agent không chạy 24/7. Nó **thức dậy theo lịch** (heartbeat), làm việc, rồi ngủ:

```
Heartbeat cycle:
  ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐
  │ Thức    │ ──▶ │ Checkout │ ──▶ │ Làm việc │ ──▶ │ Comment│ ──▶ 💤 Ngủ
  │ dậy    │     │ task     │     │ (scan,   │     │ kết quả│
  │ (tuỳ   │     │ từ inbox │     │  viết,   │     │ lên    │
  │ config) │     │          │     │  phân    │     │ task   │
  └─────────┘     └──────────┘     │  tích)   │     └────────┘
                                   └──────────┘
```

**Ví dụ Market Analyst heartbeat mỗi 2 phút:**
1. Thức dậy → Kiểm tra inbox
2. Có task "Scan Polymarket cho keyword 'AI'" → Checkout
3. Plugin Polymarket Scanner đã scan sẵn data → Agent đọc & phân tích
4. Comment: "Tìm thấy 3 market mới liên quan AI, probability > 70%..."
5. Nếu quan trọng → tạo subtask cho Content Writer: "Viết bài về AI prediction markets"
6. Đánh dấu task Done → Ngủ

### Mỗi thành viên BD có thể contribute Agent

1. Định nghĩa role + capabilities trong UI
2. Chọn adapter (claude-local thường là đủ)
3. Viết instructions (prompt) cho agent — đây là phần quan trọng nhất
4. Set budget + heartbeat schedule
5. Submit → Nếu company bật governance, cần CEO/Board approve

**Ví dụ**: Thành viên A giỏi crypto → tạo "DeFi Analyst" agent với instructions chuyên sâu về DeFi protocols. Thành viên B giỏi content → tạo "Thread Writer" agent chuyên viết X threads.

---

## Câu 3: Khi nào nên tạo Plugin? Có các loại nào? Follow framework nào?

### Plugin là gì?

**Plugin = phần mở rộng chạy độc lập**, kết nối Paperclip với thế giới bên ngoài hoặc thêm tính năng mới. Plugin chạy như 1 worker process riêng, giao tiếp với server qua JSON-RPC.

**Khác biệt quan trọng**: Agent = AI suy nghĩ & ra quyết định. Plugin = công cụ/kết nối mà agent hoặc hệ thống dùng.

```
Agent (não)  ──uses──▶  Plugin (tay chân)
                        • Gọi API bên ngoài
                        • Scan data theo lịch
                        • Gửi notification
                        • Hiển thị UI custom
```

### Khi nào nên tạo Plugin?

| Tình huống | Tạo Plugin? | Ví dụ |
|------------|------------|-------|
| Cần kết nối API bên ngoài | **Plugin** | Polymarket API, X API, Telegram Bot |
| Cần job chạy theo lịch (cron) | **Plugin** | Scan market mỗi 2 phút |
| Cần UI custom trong dashboard | **Plugin** | Bảng hiển thị market data |
| Cần cung cấp tool cho agent dùng | **Plugin** | Tool "search_polymarket" agent gọi được |
| Chỉ cần AI phân tích/viết | **Không cần** | Đó là việc của Agent |

### 4 Loại Plugin (Categories)

| Category | Mục đích | Ví dụ trong repo |
|----------|---------|------------------|
| **connector** | Kết nối dịch vụ bên ngoài | `plugin-polymarket-scanner`, `plugin-telegram-notifier`, `plugin-x-scanner` |
| **automation** | Tự động hoá quy trình | `plugin-polymarket-scanner` (scan theo cron) |
| **ui** | Thêm giao diện custom | `plugin-hello-world-example`, `plugin-file-browser-example` |
| **workspace** | Quản lý file/project | `plugin-file-browser-example` |

Một plugin có thể thuộc **nhiều category**. Ví dụ `plugin-polymarket-scanner` là cả `connector` + `automation`.

### Cấu trúc Plugin (Framework)

```
plugin-my-example/
├── package.json              ← Tên, version, dependencies
├── src/
│   ├── manifest.ts           ← Khai báo plugin: tên, capabilities, jobs, UI slots
│   ├── worker.ts             ← Logic chính: setup, job handlers, event handlers
│   └── ui/                   ← Giao diện (nếu có)
│       └── settings-page.tsx ← Trang config trong Paperclip UI
├── tsconfig.json
└── vite.config.ts
```

**3 file quan trọng nhất:**

**1. `manifest.ts`** — Khai báo plugin làm được gì:
```typescript
export const manifest = {
  id: "lab3-ai.plugin-polymarket-scanner",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",           // Gọi API ra ngoài
    "jobs.schedule",           // Chạy job theo lịch
    "plugin.state.read",       // Lưu trạng thái
    "secrets.read-ref",        // Đọc API keys an toàn
    "events.emit",             // Phát sự kiện cho plugin khác
    "agents.read",             // Đọc thông tin agent
    "agent.sessions.create",   // Tạo chat session với agent
    "agent.sessions.send",     // Gửi message cho agent
  ],
  jobs: [{
    jobKey: "scan-polymarket",
    displayName: "Scan Polymarket Markets",
    schedule: "*/2 * * * *",   // Cron string — mỗi 2 phút
  }],
  ui: {
    slots: [{
      type: "settingsPage",
      id: "polymarket-scanner-settings",
      displayName: "Polymarket Scanner Settings",
      exportName: "PolymarketScannerSettings",
    }],
  }
};
```

**2. `worker.ts`** — Logic xử lý:
```typescript
export default definePlugin({
  setup(ctx) {
    // Đăng ký job scan
    // Lưu ý: đây là pseudo-code đơn giản hoá
    // Xem plugin-polymarket-scanner/src/worker.ts để thấy code thực tế
    ctx.jobs.register("scan-polymarket", async () => {
      const resp = await ctx.http.fetch("https://gamma-api.polymarket.com/...");
      await ctx.state.set({ stateKey: "latest-scan", ... }, resp.data);
      await ctx.events.emit("market-scan-complete", companyId, { markets: resp.data });
      if (hasStrongSignal(resp.data)) {
        // Dùng sessions API để chat với agent
        const session = await ctx.agents.sessions.create(analystAgentId, companyId);
        await ctx.agents.sessions.sendMessage(session.id, "Phân tích market mới...");
      }
    });
  }
});
```

**3. `ui/settings-page.tsx`** — Config UI cho operator cấu hình API keys, keywords, thresholds.

### Plugin SDK — Những gì plugin có thể làm

| Client | Dùng để | Ví dụ |
|--------|--------|-------|
| `ctx.config` | Đọc plugin config | Lấy API keys, thresholds từ settings |
| `ctx.http` | Gọi API bên ngoài | Fetch Polymarket, X API |
| `ctx.state` | Lưu trữ key-value | Cache kết quả scan |
| `ctx.events` | Phát/nhận sự kiện | "market-scan-complete" → trigger Telegram |
| `ctx.jobs` | Chạy job theo lịch | Scan mỗi 2 phút |
| `ctx.secrets` | Đọc API keys an toàn | Telegram bot token, API keys |
| `ctx.agents` | Tương tác với agent | Đọc agent info, tạo chat session |
| `ctx.issues` | Tạo/đọc task | Tự động tạo task từ scan result |
| `ctx.companies` | Đọc thông tin company | Lấy company config |
| `ctx.goals` | Đọc/tạo/cập nhật goals | Theo dõi tiến độ mục tiêu |
| `ctx.projects` | Đọc project/workspace | Lấy project config, workspace info |
| `ctx.logger` | Ghi log | Debug, monitoring |
| `ctx.entities` | Lưu entity mapping | Map Polymarket ID → Paperclip issue |
| `ctx.activity` | Ghi audit log | "Plugin scanned 50 markets" |
| `ctx.metrics` | Ghi metrics | Số market found, response time |
| `ctx.tools` | Cung cấp tool cho agent | Agent gọi "search_market" tool |
| `ctx.data` | Cung cấp data cho UI | Dashboard widget đọc scan results |
| `ctx.actions` | Nhận action từ UI | User click "Scan Now" button |

> **Tip**: Xem `plugin-kitchen-sink-example` để thấy demo đầy đủ tất cả SDK APIs.

### Cách tạo Plugin mới

```bash
# Scaffold plugin mới
cd packages/plugins/examples
npx create-paperclip-plugin my-plugin-name

# Cấu trúc tự tạo sẵn, chỉ cần:
# 1. Edit manifest.ts → khai báo capabilities + jobs
# 2. Edit worker.ts  → viết logic
# 3. Edit ui/        → tạo settings page (nếu cần)
# 4. Build & install vào Paperclip
```

### Ví dụ Plugin mà BD có thể contribute

| Thành viên | Plugin idea | Category | Chức năng |
|------------|------------|----------|-----------|
| Người A | `plugin-coingecko-scanner` | connector, automation | Scan giá crypto từ CoinGecko mỗi 5 phút |
| Người B | `plugin-notion-sync` | connector | Sync task/content lên Notion workspace |
| Người C | `plugin-discord-notifier` | connector | Gửi alert vào Discord channel |
| Người D | `plugin-content-scheduler` | automation, ui | Lên lịch đăng bài, hiển thị calendar UI |

---

## Câu 4: Skill dùng như nào? Vào đâu?

### Skill là gì?

**Skill = tài liệu hướng dẫn (markdown) mà Agent đọc để biết cách làm việc.** Khác với Plugin (code chạy được), Skill là **kiến thức** được load vào agent lúc runtime.

```
Plugin = công cụ (code chạy)     → "Đây là cái búa"
Skill  = hướng dẫn (markdown)    → "Đây là cách dùng búa"
```

### 4 Skill hiện có

| Skill | Mục đích | Ai dùng |
|-------|---------|---------|
| **paperclip** | Hướng dẫn agent cách tương tác Paperclip API (checkout task, comment, delegate) | Mọi agent — skill cốt lõi |
| **paperclip-create-agent** | Hướng dẫn agent cách hire agent mới | CEO agent |
| **paperclip-create-plugin** | Hướng dẫn tạo plugin mới | Dev/BD khi dùng AI tạo plugin |
| **para-memory-files** | Hệ thống memory giúp agent nhớ context qua các lần chạy | Agent cần nhớ dài hạn |

### Skill dùng vào đâu?

```
Agent startup:
  1. Adapter load agent config
  2. Đọc skills/ directory → tìm skill phù hợp
  3. Inject skill content vào agent context
  4. Agent chạy heartbeat VỚI kiến thức từ skills

Ví dụ: Market Analyst agent
  Skills loaded: [paperclip, para-memory-files]
  → Agent biết cách: checkout task, comment, nhớ scan trước đó
```

### BD có thể contribute Skill

Skill chỉ là markdown file, ai cũng viết được:

```markdown
# skills/market-analysis/SKILL.md
---
name: market-analysis
description: Hướng dẫn agent phân tích thị trường crypto và prediction markets
---

## Quy trình phân tích
1. Đọc data từ plugin scan results
2. So sánh với data lần trước (dùng para-memory)
3. Đánh giá theo framework: Signal strength, Volume, Trend
4. Nếu signal > threshold → tạo subtask cho Content Writer
5. Format output theo template: [Title] [Summary] [Action Required]
```

### So sánh Agent vs Plugin vs Skill

| | Agent | Plugin | Skill |
|--|-------|--------|-------|
| **Là gì** | Nhân viên AI | Extension/tool | Tài liệu hướng dẫn |
| **Chạy bằng** | AI model (Claude, Gemini...) | Code (TypeScript worker) | Không chạy — được đọc |
| **Ra quyết định** | ✅ Suy nghĩ, phân tích | ❌ Chỉ thực thi logic cố định | ❌ Chỉ là kiến thức |
| **Ví dụ** | "Phân tích market này có đáng đầu tư?" | "Gọi Polymarket API lấy data" | "Cách phân tích market: bước 1, 2, 3..." |
| **Ai tạo** | Mọi BD (qua UI + prompt) | BD biết code (với AI hỗ trợ) | Mọi BD (chỉ viết markdown) |
| **Cost** | Tốn token AI mỗi heartbeat | Gần như miễn phí (chỉ API calls) | Miễn phí |

---

## Câu 5: Workflow của Company

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPANY LIFECYCLE                            │
│                                                                 │
│  ① CREATE          ② SETUP            ③ RUN             ④ GROW │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐│
│  │Board tạo │────▶│Hire CEO  │────▶│Agents    │────▶│Thêm    ││
│  │company + │     │+ agents  │     │heartbeat │     │agents, ││
│  │set goal  │     │Install   │     │làm việc  │     │plugins,││
│  │+ budget  │     │plugins   │     │tự động   │     │skills  ││
│  └──────────┘     │Load      │     └─────┬────┘     └────────┘│
│                   │skills    │           │                     │
│                   └──────────┘           ▼                     │
│                                   ┌──────────┐                 │
│                                   │Board     │                 │
│                                   │monitor:  │                 │
│                                   │• Budget  │                 │
│                                   │• Output  │                 │
│                                   │• Approve │                 │
│                                   └──────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

**Ví dụ cho Lab3 BD:**

| Bước | Ai làm | Hành động |
|------|--------|-----------|
| ① | Board (bạn) | Tạo company "Lab3 BD", goal: "Scan market + tạo content", budget: $500/tháng |
| ② | Board | Hire CEO agent (claude-local), install plugins (polymarket, telegram, x-scanner), load skills |
| ③ | Tự động | CEO nhận goal → tạo project → phân task → agents scan, phân tích, viết content |
| ④ | Team BD | Thành viên A contribute plugin mới, thành viên B tạo agent mới, thành viên C viết skill mới |

**Board (bạn) làm gì hàng ngày?**
- Xem dashboard: agents đã làm gì, tốn bao nhiêu token
- Approve/reject: nếu agent muốn hire agent mới hoặc thay đổi strategy
- Điều chỉnh: thêm goal, thay budget, pause agent không hiệu quả

---

## Câu 6: Workflow của Project — Móc nối Agent, Skill, Plugin

**Project = nhóm các task liên quan, thuộc 1 goal.**

### Ví dụ: Project "Weekly Market Report"

```
┌─────────────────────────────────────────────────────────────────┐
│  PROJECT: "Weekly Market Report"                                │
│  Goal: "Tạo báo cáo thị trường hàng tuần"                       │
│  Lead: Content Writer agent                                     │
│                                                                 │
│  ┌─── ROUTINE (Paperclip recurring task feature) ───────┐       │
│  │ Trigger: Cron "0 8 * * 1" (Mỗi thứ 2, 8:00 AM)     │       │
│  │ → Tự động tạo issue: "Weekly Report - tuần XX"       │       │
│  │ (Tạo Routine trong UI → Routines, hoặc qua API)     │       │
│  └──────────────────────┬───────────────────────────────┘       │
│                         ▼                                       │
│  ┌─── ISSUE FLOW ──────────────────────────────────────┐        │
│  │                                                      │        │
│  │  CEO checkout "Weekly Report"                        │        │
│  │    │                                                 │        │
│  │    ├── Subtask ──▶ "Scan Polymarket tuần này"       │        │
│  │    │                Assign: Market Analyst            │        │
│  │    │                Dùng: plugin polymarket-scanner   │        │
│  │    │                Skill: paperclip + para-memory    │        │
│  │    │                                                  │        │
│  │    ├── Subtask ──▶ "Scan X/Twitter tuần này"        │        │
│  │    │                Assign: Market Analyst            │        │
│  │    │                Dùng: plugin x-scanner            │        │
│  │    │                                                  │        │
│  │    └── Subtask ──▶ "Viết báo cáo tổng hợp"         │        │
│  │                     Assign: Content Writer            │        │
│  │                     Đợi 2 subtask trên done           │        │
│  │                     → Đọc comments/documents          │        │
│  │                     → Viết report → Post Telegram     │        │
│  └──────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Cách móc nối cụ thể

```
① Plugin SCAN (chạy tự động theo cron)
   polymarket-scanner job chạy mỗi 2 phút
   → Lưu data vào plugin state
   → Emit event "market-scan-complete"
        │
        ▼
② Plugin NOTIFY (lắng nghe event)
   telegram-notifier subscribe "market-scan-complete"
   → Nếu có signal mạnh → gửi Telegram alert
        │
        ▼
③ Agent PHÂN TÍCH (được đánh thức)
   Market Analyst checkout task
   → Skill paperclip: biết cách checkout, comment
   → Skill para-memory: nhớ context tuần trước
   → Đọc plugin state (scan results)
   → Phân tích → Comment kết quả lên task → Mark done
        │
        ▼
④ Agent VIẾT (checkout task tiếp)
   Content Writer checkout "Viết báo cáo"
   → Đọc comments từ Market Analyst
   → Viết content
   → Plugin telegram-notifier: post báo cáo → Mark done
```

### Tóm lại cách 3 thứ kết nối

| Thành phần | Vai trò trong workflow | Giao tiếp qua |
|-----------|----------------------|----------------|
| **Plugin** | Cung cấp data + tool + notification | Events, State, HTTP |
| **Agent** | Suy nghĩ, phân tích, ra quyết định, tạo content | Tasks (issues), Comments, Documents |
| **Skill** | Dạy agent cách làm việc đúng | Loaded vào agent context lúc startup |

---

## Câu 7: Kế thừa Agents, Plugins giữa các Project

Paperclip thiết kế **company-scoped**:

```
┌── Company "Lab3 BD" ──────────────────────────────────┐
│                                                        │
│  Agents:    CEO, Market Analyst, Content Writer        │
│  Plugins:   polymarket-scanner, telegram-notifier      │
│  Skills:    paperclip, para-memory                     │
│                                                        │
│  ┌── Project A ────────┐  ┌── Project B ────────┐     │
│  │ "Weekly Report"      │  │ "Polymarket Alpha" │     │
│  │                      │  │                     │     │
│  │ Dùng CHUNG agents   │  │ Dùng CHUNG agents  │     │
│  │ Dùng CHUNG plugins  │  │ Dùng CHUNG plugins │     │
│  │ Dùng CHUNG skills   │  │ Dùng CHUNG skills  │     │
│  │                      │  │                     │     │
│  │ Tasks riêng          │  │ Tasks riêng         │     │
│  └──────────────────────┘  └─────────────────────┘     │
└────────────────────────────────────────────────────────┘
```

### Quy tắc kế thừa

| Thành phần | Scope | Kế thừa? |
|-----------|-------|----------|
| **Agent** | Company-level | ✅ Agent dùng chung cho mọi project trong company |
| **Plugin** | Instance-level (toàn hệ thống) | ✅ Plugin install 1 lần, mọi company/project dùng được |
| **Skill** | Company-level | ✅ Skill import vào company, mọi agent trong company dùng được |
| **Task/Issue** | Project-level | ❌ Task thuộc riêng 1 project |

### Kế thừa giữa các Company (Export/Import)

```
Company A: "Lab3 BD - Dev"
  │  POST /api/companies/:companyId/exports/preview  (xem trước)
  │  POST /api/companies/:companyId/exports           (export JSON)
  │  → Export: agents config, org chart, goals, skills
  ▼
Company B: "Lab3 BD - Prod"
  │  POST /api/companies/:companyId/imports/preview   (xem trước)
  │  POST /api/companies/:companyId/imports/apply     (apply)
  │  → Import: copy toàn bộ setup từ Company A
```

### Flow contribution của team BD

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ BD viết  │────▶│ Push lên │────▶│ Team     │────▶│ Install  │
│ plugin/  │     │ git repo │     │ pull     │     │ vào      │
│ skill/   │     │          │     │ code     │     │ company  │
│ agent    │     │          │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
    AI hỗ trợ        PR review       pnpm install    UI hoặc API
```

**Cụ thể:**

- **Plugin**: Push code vào `packages/plugins/examples/` → team pull → install qua UI
- **Skill**: Push markdown vào `skills/` → team pull → import qua API `POST /api/companies/:companyId/skills/import`
- **Agent config**: Export company → share JSON → import vào company khác

---

## Quick Reference: Bắt đầu từ đâu?

| Bước | Hành động | Command/UI |
|------|-----------|------------|
| 1 | Chạy Paperclip local | `pnpm install && pnpm dev` → localhost:3100 |
| 2 | Tạo Company trong UI | UI → Create Company |
| 3 | Tạo CEO Agent | UI → Add Agent (claude-local) |
| 4 | Install plugins đã có | UI → Plugin Manager → Install bundled examples |
| 5 | Tạo Goal + Project | UI → Goals → New Goal, Projects → New Project |
| 6 | Tạo Task đầu tiên | UI → Issues → New Issue → Assign cho agent |
| 7 | Xem agent chạy | Agent heartbeat → checkout task → xem comments |
| 8 | Contribute | Viết plugin/skill/agent → push git → team install |
