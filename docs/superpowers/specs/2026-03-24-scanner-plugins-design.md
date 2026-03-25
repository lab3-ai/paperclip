# Scanner & Notifier Plugins Design

Status: reviewed
Date: 2026-03-24
Approach: Pure Paperclip Plugin (Approach A)

## Overview

Three independent Paperclip plugins that scan external data sources, store results in Supabase, and send notifications via Telegram.

```
X Scanner (cron 15m) ──► RapidAPI ──► Supabase (x_posts)
Polymarket Scanner (cron 1h) ──► Gamma API ──► AI analyze ──► Supabase (polymarket_markets)
                                                            ──► emit event
Telegram Notifier (event-driven) ◄── subscribe event ──► Telegram Bot API ──► Group
```

## Supabase Schema

### Table: x_posts

```sql
create table x_posts (
  id uuid default gen_random_uuid() primary key,
  post_id text not null unique,
  author_handle text not null,
  author_name text,
  content text not null,
  posted_at timestamptz not null,
  likes_count int default 0,
  retweets_count int default 0,
  replies_count int default 0,
  url text,
  media_urls jsonb default '[]',
  raw_data jsonb,
  created_at timestamptz default now()
);

create index idx_x_posts_author on x_posts(author_handle);
create index idx_x_posts_posted_at on x_posts(posted_at desc);
```

### Table: polymarket_markets

```sql
create table polymarket_markets (
  id uuid default gen_random_uuid() primary key,
  market_id text not null unique,
  question text not null,
  description text,
  category text,
  outcome_prices jsonb,
  volume numeric,
  liquidity numeric,
  end_date timestamptz,
  status text default 'active',
  matched_keywords text[],
  ai_relevance_score numeric,
  ai_analysis text,
  url text,
  raw_data jsonb,
  notified_at timestamptz,
  last_scanned_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_pm_markets_status on polymarket_markets(status);
create index idx_pm_markets_relevance on polymarket_markets(ai_relevance_score desc);
create index idx_pm_markets_notified on polymarket_markets(notified_at);

-- Auto-update updated_at on row modification
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_pm_markets_updated_at
  before update on polymarket_markets
  for each row execute function update_updated_at();
```

---

## Plugin 1: X Scanner

### Identity

- ID: `@yourscope/plugin-x-scanner`
- Categories: `connector`, `automation`
- Capabilities: `http.outbound`, `jobs.schedule`, `plugin.state.read`, `plugin.state.write`, `secrets.read-ref`, `activity.log.write`

### Cron Job

- Job key: `scan-x-posts`
- Schedule: `*/15 * * * *` (every 15 minutes)

### Config

```ts
interface XScannerConfig {
  rapidApiKey: string;           // Secret
  supabaseUrl: string;
  supabaseServiceKey: string;    // Secret
  members: string[];             // Twitter handles without @
  scanIntervalMinutes: number;   // Default: 15
  maxPostsPerMember: number;     // Default: 20
}
```

### Flow per cron cycle

1. Job `scan-x-posts` triggered
2. Check `state.get("scanRunning")` — if true, skip this cycle (guard against overlapping runs)
3. `state.set("scanRunning", true)`
4. Read config, get member list
5. For each member:
   a. Call RapidAPI to get recent posts
   b. Filter: only posts newer than `state.get("lastScanAt")`
   c. Batch upsert to Supabase `x_posts` (`ON CONFLICT post_id DO NOTHING`)
6. `state.set("lastScanAt", <timestamp of most recent successfully processed post>)` (not `now()`, to avoid missing posts during slow runs)
7. `state.set("scanRunning", false)`
8. `ctx.activity.log("Scanned X posts: {count} new from {members}")`

### Error Handling

- RapidAPI rate limit (429): log warning, skip remaining members, retry next cycle
- RapidAPI quota exhaustion: log error, pause job, notify via activity log
- Supabase connection failure: retry 3 times with backoff, then log error and skip cycle
- Partial batch failure: process successful members, log failed ones, continue next cycle
- Always set `scanRunning = false` in finally block

### Settings UI

- Add/remove members (input + tag list)
- Set scan interval
- View scan history (last run, posts found)
- Test connection (verify RapidAPI key + Supabase)

---

## Plugin 2: Polymarket Scanner

### Identity

- ID: `@yourscope/plugin-polymarket-scanner`
- Categories: `connector`, `automation`
- Capabilities: `http.outbound`, `jobs.schedule`, `plugin.state.read`, `plugin.state.write`, `secrets.read-ref`, `events.emit`, `agents.invoke`, `agents.read`, `activity.log.write`

### Cron Job

- Job key: `scan-polymarket`
- Schedule: `0 * * * *` (every hour)

### Config

```ts
interface PolymarketConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;       // Secret
  keywords: string[];               // e.g. ["Bitcoin", "Trump", "AI"]
  minVolume: number;                 // Default: 1000
  minAiRelevanceScore: number;       // Default: 0.6
  scanIntervalMinutes: number;       // Default: 60
  agentSlug: string;                 // Paperclip agent slug for AI analyze
  companyId: string;                 // Paperclip company ID (for events + agent invoke)
}
```

### Flow per cron cycle

**Phase 1: Keyword Filter (rule-based)**

1. Job `scan-polymarket` triggered
2. Check `state.get("scanRunning")` — if true, skip this cycle
3. `state.set("scanRunning", true)`
4. Read config, get keywords
5. Call Gamma API: `GET /markets?tag=<keyword>&active=true&closed=false`
6. Merge results across keywords, dedup by `market_id`
7. Filter: `volume >= minVolume`, only new or updated markets

**Phase 2: AI Analyze**

8. Batch markets without `ai_relevance_score`
9. Resolve agent: `ctx.agents.get(agentSlug)` to get agent ID
10. Call `ctx.agents.invoke(agentId, companyId, prompt)` with:
    ```
    Analyze these markets. For each, rate relevance 0-1
    to topics: {keywords}. Return JSON with score + reasoning.
    ```
11. Parse AI response, update `ai_relevance_score` + `ai_analysis`

**Phase 3: Save + Trigger**

12. Upsert ALL discovered markets to Supabase (preserve full scan history)
13. For markets with `score >= minAiRelevanceScore` AND `notified_at` is null:
    ```ts
    ctx.events.emit("new_markets", config.companyId, {
      markets: [{ question, outcome_prices, ai_relevance_score, ai_analysis, url, market_id }]
    })
    ```
    Note: Event is auto-namespaced to `plugin.@yourscope/plugin-polymarket-scanner.new_markets`
14. `state.set("lastScanAt", now())`
15. `state.set("scanRunning", false)`
16. `ctx.activity.log("Scanned Polymarket: {count} markets, {new} new relevant")`

### Error Handling

- Gamma API downtime/HTTP errors: retry 3 times with backoff, then skip cycle
- `agents.invoke` failure (agent unavailable, timeout): log error, save markets without AI analysis, retry AI on next cycle for markets with null `ai_relevance_score`
- `agents.invoke` malformed response: log warning, set `ai_relevance_score = null`, retry next cycle
- Supabase connection failure: retry 3 times with backoff, then log error and skip cycle
- Always set `scanRunning = false` in finally block

### Settings UI

- Config keywords (tag list)
- Set min volume, min AI score threshold
- Select Paperclip agent for AI analyze
- Input company ID
- View scan history + last results
- Test connection (Gamma API + Supabase)

---

## Plugin 3: Telegram Notifier

### Identity

- ID: `@yourscope/plugin-telegram-notifier`
- Categories: `connector`
- Capabilities: `http.outbound`, `events.subscribe`, `plugin.state.read`, `plugin.state.write`, `secrets.read-ref`, `activity.log.write`

### Config

```ts
interface TelegramConfig {
  botToken: string;           // Secret
  chatId: string;             // Telegram group chat ID
  supabaseUrl: string;
  supabaseServiceKey: string; // Secret
}
```

### Flow (event-driven)

1. Subscribe to event `plugin.@yourscope/plugin-polymarket-scanner.new_markets` via `ctx.events.on()`
2. On event received:
   a. Parse markets array from event payload
   b. For each market, format message:
      ```
      New Polymarket Alert

      Q: Will Bitcoin reach $100k by July 2026?
      YES: 72% | NO: 28%
      Volume: $125,000
      AI Score: 0.85

      https://polymarket.com/event/...
      ```
   c. Call Telegram Bot API: `POST https://api.telegram.org/bot<token>/sendMessage`
      - `chat_id`: config.chatId
      - `text`: formatted message
      - `parse_mode`: "Markdown"
   d. Update Supabase: `SET notified_at = now() WHERE market_id = ...`
   e. `ctx.activity.log("Sent {count} notifications to Telegram")`

### Error Handling

- Telegram API fail: retry 3 times with exponential backoff
- If still fails: log error, do not block event queue, market stays with `notified_at = null` for manual retry
- Rate limit: max 20 messages/minute (Telegram group limit), queue excess messages with delay
- Supabase update fail: log warning, notification was sent but `notified_at` not updated (idempotent on next event since Telegram message already sent)

### Settings UI

- Input bot token + chat ID
- Test connection (send test message)
- View notification history (last sent, count)

---

## Distribution

### Publishing

Each plugin publishes independently to npm:

```bash
cd plugin-x-scanner && npm publish --access public
cd plugin-polymarket-scanner && npm publish --access public
cd plugin-telegram-notifier && npm publish --access public
```

### Installation by friends

```bash
paperclipai plugin install @yourscope/plugin-x-scanner
paperclipai plugin install @yourscope/plugin-polymarket-scanner
paperclipai plugin install @yourscope/plugin-telegram-notifier
```

Config via Paperclip UI settings pages.

### Prerequisites for friends

1. Paperclip instance running
2. Supabase project (free tier OK) with tables created via provided SQL
3. RapidAPI account with X API endpoint subscription
4. Telegram bot (via BotFather) added to target group
5. (Polymarket only) A Paperclip agent with Claude adapter for AI analyze

### Deliverables per plugin

- `README.md`: setup guide, prerequisites, config docs
- `supabase-schema.sql`: SQL migration for table creation
- Example config with required secrets listed
