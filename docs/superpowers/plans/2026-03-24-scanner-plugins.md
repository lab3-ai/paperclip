# Scanner & Notifier Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three independent Paperclip plugins — X Scanner, Polymarket Scanner, and Telegram Notifier — that scan external APIs, store results in Supabase, and send Telegram notifications.

**Architecture:** Each plugin is a standalone npm package using the Paperclip Plugin SDK. X Scanner and Polymarket Scanner use cron jobs (`jobs.schedule`). Polymarket Scanner uses `agents.invoke` for AI analysis and `events.emit` to trigger Telegram Notifier, which subscribes via `events.subscribe`. All three write to an external Supabase database via `http.outbound`.

**Tech Stack:** TypeScript, Paperclip Plugin SDK (`@paperclipai/plugin-sdk`), Supabase JS client (`@supabase/supabase-js`), esbuild, vitest

**Spec:** `docs/superpowers/specs/2026-03-24-scanner-plugins-design.md`

---

## File Structure

### Shared SQL (delivered with each plugin README)

- `supabase-schema.sql` — DDL for `x_posts` and `polymarket_markets` tables

### Plugin 1: X Scanner (`plugin-x-scanner/`)

```
plugin-x-scanner/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── esbuild.config.mjs
├── supabase-schema.sql
├── README.md
├── src/
│   ├── manifest.ts          — Plugin manifest (id, capabilities, jobs)
│   ├── worker.ts             — Plugin entry: setup, job handler, event wiring
│   ├── scanner.ts            — Core scan logic: call RapidAPI, filter, return posts
│   ├── supabase.ts           — Supabase client: upsert posts
│   ├── types.ts              — Shared types (XScannerConfig, XPost, RapidAPIResponse)
│   └── ui/
│       └── index.tsx         — Settings page: member list, scan interval, test connection
└── tests/
    ├── scanner.spec.ts       — Unit tests for scanner logic
    ├── supabase.spec.ts      — Unit tests for Supabase upsert
    └── worker.spec.ts        — Integration test with plugin test harness
```

### Plugin 2: Polymarket Scanner (`plugin-polymarket-scanner/`)

```
plugin-polymarket-scanner/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── esbuild.config.mjs
├── supabase-schema.sql
├── README.md
├── src/
│   ├── manifest.ts          — Plugin manifest
│   ├── worker.ts             — Plugin entry: setup, job handler, event emit
│   ├── scanner.ts            — Core scan logic: call Gamma API, keyword filter
│   ├── analyzer.ts           — AI analysis: build prompt, parse response
│   ├── supabase.ts           — Supabase client: upsert markets
│   ├── types.ts              — Shared types (PolymarketConfig, Market, GammaResponse)
│   └── ui/
│       └── index.tsx         — Settings page: keywords, thresholds, agent picker
└── tests/
    ├── scanner.spec.ts       — Unit tests for Gamma API scanner
    ├── analyzer.spec.ts      — Unit tests for AI prompt/response parsing
    ├── supabase.spec.ts      — Unit tests for Supabase upsert
    └── worker.spec.ts        — Integration test with plugin test harness
```

### Plugin 3: Telegram Notifier (`plugin-telegram-notifier/`)

```
plugin-telegram-notifier/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── esbuild.config.mjs
├── README.md
├── src/
│   ├── manifest.ts          — Plugin manifest
│   ├── worker.ts             — Plugin entry: setup, event subscription
│   ├── notifier.ts           — Core notify logic: format message, call Telegram API
│   ├── supabase.ts           — Supabase client: update notified_at
│   ├── types.ts              — Shared types (TelegramConfig, MarketEvent)
│   └── ui/
│       └── index.tsx         — Settings page: bot token, chat ID, test send
└── tests/
    ├── notifier.spec.ts      — Unit tests for message formatting and send
    ├── worker.spec.ts        — Integration test with plugin test harness
```

---

## Task 0: Supabase Schema Setup

**Files:**
- Create: `plugin-x-scanner/supabase-schema.sql`

- [ ] **Step 1: Create the SQL schema file**

```sql
-- x_posts table
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

-- polymarket_markets table
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

- [ ] **Step 2: Run the schema in Supabase**

Go to Supabase Dashboard → SQL Editor → paste and run the SQL above.

- [ ] **Step 3: Verify tables exist**

In Supabase Dashboard → Table Editor, confirm `x_posts` and `polymarket_markets` tables are visible with correct columns.

---

## Task 1: Scaffold Plugin 1 — X Scanner

**Files:**
- Create: `plugin-x-scanner/package.json`
- Create: `plugin-x-scanner/tsconfig.json`
- Create: `plugin-x-scanner/vitest.config.ts`
- Create: `plugin-x-scanner/esbuild.config.mjs`
- Create: `plugin-x-scanner/src/types.ts`
- Create: `plugin-x-scanner/src/manifest.ts`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir -p plugin-x-scanner/src/ui plugin-x-scanner/tests
cd plugin-x-scanner
```

```json
{
  "name": "@yourscope/plugin-x-scanner",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "paperclipPlugin": {
    "manifest": "./dist/manifest.js",
    "worker": "./dist/worker.js",
    "ui": "./dist/ui/"
  },
  "scripts": {
    "build": "node ./esbuild.config.mjs",
    "dev": "node ./esbuild.config.mjs --watch",
    "test": "vitest run --config ./vitest.config.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0"
  },
  "devDependencies": {
    "@paperclipai/plugin-sdk": "workspace:*",
    "esbuild": "^0.25.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

Note: If building outside the Paperclip monorepo, use the SDK tarball approach from the scaffold guide instead of `workspace:*`.

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src", "tests"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Create esbuild.config.mjs**

```javascript
import esbuild from "esbuild";
import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";

const presets = createPluginBundlerPresets({ uiEntry: "src/ui/index.tsx" });
const watch = process.argv.includes("--watch");

const workerCtx = await esbuild.context(presets.esbuild.worker);
const manifestCtx = await esbuild.context(presets.esbuild.manifest);
const uiCtx = await esbuild.context(presets.esbuild.ui);

if (watch) {
  await Promise.all([workerCtx.watch(), manifestCtx.watch(), uiCtx.watch()]);
} else {
  await Promise.all([
    workerCtx.rebuild(),
    manifestCtx.rebuild(),
    uiCtx.rebuild(),
  ]);
  await Promise.all([
    workerCtx.dispose(),
    manifestCtx.dispose(),
    uiCtx.dispose(),
  ]);
}
```

- [ ] **Step 5: Create src/types.ts**

```typescript
export interface XScannerConfig {
  rapidApiKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  members: string[];
  scanIntervalMinutes: number;
  maxPostsPerMember: number;
  companyId: string;
}

export interface XPost {
  post_id: string;
  author_handle: string;
  author_name: string | null;
  content: string;
  posted_at: string;
  likes_count: number;
  retweets_count: number;
  replies_count: number;
  url: string | null;
  media_urls: string[];
  raw_data: unknown;
}

export interface RapidAPITweet {
  id: string;
  text: string;
  created_at: string;
  author: {
    username: string;
    name: string;
  };
  likes: number;
  retweets: number;
  replies: number;
  url?: string;
  media?: Array<{ url: string }>;
}
```

- [ ] **Step 6: Create src/manifest.ts**

```typescript
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "yourscope.plugin-x-scanner",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "X Post Scanner",
  description: "Scans X (Twitter) posts from configured members via RapidAPI and saves to Supabase",
  author: "yourscope",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "jobs.schedule",
    "plugin.state.read",
    "plugin.state.write",
    "secrets.read-ref",
    "activity.log.write",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  jobs: [
    {
      jobKey: "scan-x-posts",
      displayName: "Scan X Posts",
      description: "Fetch recent posts from configured X members",
      schedule: "*/15 * * * *",
    },
  ],
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: "x-scanner-settings",
        displayName: "X Scanner Settings",
        exportName: "XScannerSettings",
      },
    ],
  },
};

export default manifest;
```

- [ ] **Step 7: Install dependencies and verify typecheck**

```bash
cd plugin-x-scanner
pnpm install
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 8: Commit scaffold**

```bash
git add plugin-x-scanner/
git commit -m "feat: scaffold plugin-x-scanner package"
```

---

## Task 2: X Scanner — Core Scanner Logic

**Files:**
- Create: `plugin-x-scanner/src/scanner.ts`
- Create: `plugin-x-scanner/tests/scanner.spec.ts`

- [ ] **Step 1: Write the failing test for scanMemberPosts**

```typescript
// tests/scanner.spec.ts
import { describe, it, expect, vi } from "vitest";
import { scanMemberPosts, mapTweetToXPost, filterNewPosts } from "../src/scanner.js";

describe("mapTweetToXPost", () => {
  it("maps a RapidAPI tweet to XPost format", () => {
    const tweet = {
      id: "123456",
      text: "Hello world",
      created_at: "2026-03-24T10:00:00Z",
      author: { username: "testuser", name: "Test User" },
      likes: 42,
      retweets: 10,
      replies: 5,
      url: "https://x.com/testuser/status/123456",
      media: [{ url: "https://pbs.twimg.com/media/abc.jpg" }],
    };

    const post = mapTweetToXPost(tweet);

    expect(post.post_id).toBe("123456");
    expect(post.author_handle).toBe("testuser");
    expect(post.author_name).toBe("Test User");
    expect(post.content).toBe("Hello world");
    expect(post.posted_at).toBe("2026-03-24T10:00:00Z");
    expect(post.likes_count).toBe(42);
    expect(post.retweets_count).toBe(10);
    expect(post.replies_count).toBe(5);
    expect(post.url).toBe("https://x.com/testuser/status/123456");
    expect(post.media_urls).toEqual(["https://pbs.twimg.com/media/abc.jpg"]);
  });

  it("handles missing media", () => {
    const tweet = {
      id: "789",
      text: "No media",
      created_at: "2026-03-24T10:00:00Z",
      author: { username: "user2", name: "User Two" },
      likes: 0,
      retweets: 0,
      replies: 0,
    };

    const post = mapTweetToXPost(tweet);
    expect(post.media_urls).toEqual([]);
    expect(post.url).toBeNull();
  });
});

describe("filterNewPosts", () => {
  it("returns all posts when lastScanAt is null", () => {
    const posts = [
      { post_id: "1", posted_at: "2026-03-24T09:00:00Z" },
      { post_id: "2", posted_at: "2026-03-24T10:00:00Z" },
    ] as any[];

    const result = filterNewPosts(posts, null);
    expect(result).toHaveLength(2);
  });

  it("filters posts older than lastScanAt", () => {
    const posts = [
      { post_id: "1", posted_at: "2026-03-24T09:00:00Z" },
      { post_id: "2", posted_at: "2026-03-24T11:00:00Z" },
    ] as any[];

    const result = filterNewPosts(posts, "2026-03-24T10:00:00Z");
    expect(result).toHaveLength(1);
    expect(result[0].post_id).toBe("2");
  });
});

describe("scanMemberPosts", () => {
  it("calls RapidAPI and returns mapped posts", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "111",
            text: "Post 1",
            created_at: "2026-03-24T09:00:00Z",
            author: { username: "alice", name: "Alice" },
            likes: 5,
            retweets: 1,
            replies: 0,
          },
        ],
      }),
    });

    const posts = await scanMemberPosts(
      mockFetch,
      "alice",
      "test-rapid-api-key",
      20
    );

    expect(posts).toHaveLength(1);
    expect(posts[0].author_handle).toBe("alice");
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("alice"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-rapidapi-key": "test-rapid-api-key",
        }),
      })
    );
  });

  it("returns empty array on API error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });

    const posts = await scanMemberPosts(
      mockFetch,
      "bob",
      "test-key",
      20
    );

    expect(posts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd plugin-x-scanner
pnpm test
```

Expected: FAIL — `scanMemberPosts` and `mapTweetToXPost` not found.

- [ ] **Step 3: Implement scanner.ts**

```typescript
// src/scanner.ts
import type { XPost, RapidAPITweet } from "./types.js";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const RAPIDAPI_HOST = "twitter-api45.p.rapidapi.com";
const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;

export function mapTweetToXPost(tweet: RapidAPITweet): XPost {
  return {
    post_id: tweet.id,
    author_handle: tweet.author.username,
    author_name: tweet.author.name ?? null,
    content: tweet.text,
    posted_at: tweet.created_at,
    likes_count: tweet.likes ?? 0,
    retweets_count: tweet.retweets ?? 0,
    replies_count: tweet.replies ?? 0,
    url: tweet.url ?? null,
    media_urls: tweet.media?.map((m) => m.url) ?? [],
    raw_data: tweet,
  };
}

export async function scanMemberPosts(
  fetch: FetchFn,
  member: string,
  rapidApiKey: string,
  maxPosts: number
): Promise<XPost[]> {
  const url = `${RAPIDAPI_BASE_URL}/timeline.php?screenname=${encodeURIComponent(member)}&count=${maxPosts}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": rapidApiKey,
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { results: RapidAPITweet[] };
  const tweets = data.results ?? [];

  return tweets.map(mapTweetToXPost);
}

export function filterNewPosts(posts: XPost[], lastScanAt: string | null): XPost[] {
  if (!lastScanAt) return posts;
  const cutoff = new Date(lastScanAt).getTime();
  return posts.filter((p) => new Date(p.posted_at).getTime() > cutoff);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin-x-scanner/src/scanner.ts plugin-x-scanner/tests/scanner.spec.ts
git commit -m "feat(x-scanner): add core scanner logic with RapidAPI integration"
```

---

## Task 3: X Scanner — Supabase Client

**Files:**
- Create: `plugin-x-scanner/src/supabase.ts`
- Create: `plugin-x-scanner/tests/supabase.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/supabase.spec.ts
import { describe, it, expect, vi } from "vitest";
import { upsertPosts, createSupabaseClient } from "../src/supabase.js";
import type { XPost } from "../src/types.js";

describe("upsertPosts", () => {
  it("calls supabase upsert with correct data", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
    const mockClient = { from: mockFrom } as any;

    const posts: XPost[] = [
      {
        post_id: "123",
        author_handle: "alice",
        author_name: "Alice",
        content: "Hello",
        posted_at: "2026-03-24T10:00:00Z",
        likes_count: 5,
        retweets_count: 1,
        replies_count: 0,
        url: "https://x.com/alice/123",
        media_urls: [],
        raw_data: {},
      },
    ];

    const result = await upsertPosts(mockClient, posts);

    expect(mockFrom).toHaveBeenCalledWith("x_posts");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ post_id: "123", author_handle: "alice" }),
      ]),
      { onConflict: "post_id", ignoreDuplicates: true }
    );
    expect(result.inserted).toBe(1);
  });

  it("returns 0 inserted on empty array", async () => {
    const mockClient = { from: vi.fn() } as any;
    const result = await upsertPosts(mockClient, []);
    expect(result.inserted).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL — `upsertPosts` not found.

- [ ] **Step 3: Implement supabase.ts**

```typescript
// src/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { XPost } from "./types.js";

export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key);
}

export async function upsertPosts(
  client: SupabaseClient,
  posts: XPost[]
): Promise<{ inserted: number; error: string | null }> {
  if (posts.length === 0) {
    return { inserted: 0, error: null };
  }

  const rows = posts.map((p) => ({
    post_id: p.post_id,
    author_handle: p.author_handle,
    author_name: p.author_name,
    content: p.content,
    posted_at: p.posted_at,
    likes_count: p.likes_count,
    retweets_count: p.retweets_count,
    replies_count: p.replies_count,
    url: p.url,
    media_urls: p.media_urls,
    raw_data: p.raw_data,
  }));

  const { error } = await client.from("x_posts").upsert(rows, {
    onConflict: "post_id",
    ignoreDuplicates: true,
  });

  if (error) {
    return { inserted: 0, error: error.message };
  }

  return { inserted: rows.length, error: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin-x-scanner/src/supabase.ts plugin-x-scanner/tests/supabase.spec.ts
git commit -m "feat(x-scanner): add Supabase upsert client"
```

---

## Task 4: X Scanner — Worker (Plugin Entry)

**Files:**
- Create: `plugin-x-scanner/src/worker.ts`
- Create: `plugin-x-scanner/tests/worker.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/worker.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

describe("X Scanner worker", () => {
  it("sets up without error", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });

    await plugin.definition.setup(harness.ctx);

    const health = await plugin.definition.onHealth!();
    expect(health.status).toBe("ok");
  });

  it("registers scan-x-posts job handler", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });

    await plugin.definition.setup(harness.ctx);

    // Job handler should be registered — running it will attempt config read
    // which returns undefined in test, so we just verify no crash on setup
    expect(harness.logs.some((l) => l.message.includes("setup"))).toBe(true);
  });

  it("registers settings data handler", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });

    await plugin.definition.setup(harness.ctx);

    const data = await harness.getData("scanner-status", {});
    expect(data).toHaveProperty("lastScanAt");
    expect(data).toHaveProperty("scanRunning");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL — `../src/worker.js` module not found.

- [ ] **Step 3: Implement worker.ts**

```typescript
// src/worker.ts
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginJobContext } from "@paperclipai/plugin-sdk";
import { scanMemberPosts, filterNewPosts } from "./scanner.js";
import { createSupabaseClient, upsertPosts } from "./supabase.js";
import type { XScannerConfig } from "./types.js";

const PLUGIN_NAME = "x-scanner";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup complete`);

    // Register cron job handler
    ctx.jobs.register("scan-x-posts", async (job: PluginJobContext) => {
      // Guard against overlapping runs
      const scanRunning = await ctx.state.get({
        scopeKind: "instance",
        stateKey: "scanRunning",
      });
      if (scanRunning) {
        ctx.logger.info("Scan already running, skipping this cycle");
        return;
      }

      try {
        await ctx.state.set(
          { scopeKind: "instance", stateKey: "scanRunning" },
          true
        );

        const config = (await ctx.config.get()) as XScannerConfig;
        if (!config?.members?.length) {
          ctx.logger.warn("No members configured, skipping scan");
          return;
        }

        const rapidApiKey = await ctx.secrets.resolve(config.rapidApiKey);
        const supabase = createSupabaseClient(
          config.supabaseUrl,
          await ctx.secrets.resolve(config.supabaseServiceKey)
        );

        const lastScanAt = (await ctx.state.get({
          scopeKind: "instance",
          stateKey: "lastScanAt",
        })) as string | null;

        let totalInserted = 0;
        let latestPostTime = lastScanAt;
        const failedMembers: string[] = [];

        for (const member of config.members) {
          try {
            const posts = await scanMemberPosts(
              ctx.http.fetch.bind(ctx.http),
              member,
              rapidApiKey,
              config.maxPostsPerMember ?? 20
            );

            const newPosts = filterNewPosts(posts, lastScanAt);
            if (newPosts.length === 0) continue;

            const result = await upsertPosts(supabase, newPosts);
            if (result.error) {
              ctx.logger.error(`Supabase upsert failed for ${member}`, {
                error: result.error,
              });
              failedMembers.push(member);
              continue;
            }

            totalInserted += result.inserted;

            // Track latest post timestamp
            for (const p of newPosts) {
              if (!latestPostTime || p.posted_at > latestPostTime) {
                latestPostTime = p.posted_at;
              }
            }
          } catch (err) {
            ctx.logger.error(`Failed to scan member ${member}`, {
              error: String(err),
            });
            failedMembers.push(member);
          }
        }

        // Update lastScanAt to latest processed post time
        if (latestPostTime && latestPostTime !== lastScanAt) {
          await ctx.state.set(
            { scopeKind: "instance", stateKey: "lastScanAt" },
            latestPostTime
          );
        }

        await ctx.activity.log({
          companyId: config.companyId,
          message: `Scanned X posts: ${totalInserted} new from ${config.members.length} members${failedMembers.length ? ` (${failedMembers.length} failed)` : ""}`,
          metadata: {
            plugin: PLUGIN_NAME,
            inserted: totalInserted,
            failedMembers,
          },
        });
      } finally {
        await ctx.state.set(
          { scopeKind: "instance", stateKey: "scanRunning" },
          false
        );
      }
    });

    // Register data handler for UI
    ctx.data.register(
      "scanner-status",
      async (params: Record<string, unknown>) => {
        const lastScanAt = await ctx.state.get({
          scopeKind: "instance",
          stateKey: "lastScanAt",
        });
        const scanRunning = await ctx.state.get({
          scopeKind: "instance",
          stateKey: "scanRunning",
        });
        return { lastScanAt: lastScanAt ?? null, scanRunning: !!scanRunning };
      }
    );
  },

  async onHealth() {
    return { status: "ok", message: "X Scanner plugin ready" };
  },

  async onValidateConfig(config: Record<string, unknown>) {
    const errors: string[] = [];
    if (!config.rapidApiKey) errors.push("rapidApiKey is required");
    if (!config.supabaseUrl) errors.push("supabaseUrl is required");
    if (!config.supabaseServiceKey) errors.push("supabaseServiceKey is required");
    if (!config.companyId) errors.push("companyId is required");
    if (
      !config.members ||
      !Array.isArray(config.members) ||
      config.members.length === 0
    )
      errors.push("members must be a non-empty array");
    return { ok: errors.length === 0, errors };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin-x-scanner/src/worker.ts plugin-x-scanner/tests/worker.spec.ts
git commit -m "feat(x-scanner): add worker with cron job handler and state management"
```

---

## Task 5: X Scanner — Settings UI

**Files:**
- Create: `plugin-x-scanner/src/ui/index.tsx`

- [ ] **Step 1: Implement the settings page component**

```tsx
// src/ui/index.tsx
import { useState } from "react";
import {
  usePluginData,
  usePluginAction,
  useHostContext,
  usePluginToast,
  type PluginSettingsPageProps,
} from "@paperclipai/plugin-sdk/ui";

interface ScannerStatus {
  lastScanAt: string | null;
  scanRunning: boolean;
}

export function XScannerSettings({ context }: PluginSettingsPageProps) {
  const toast = usePluginToast();
  const { data: status, loading, refresh } = usePluginData<ScannerStatus>(
    "scanner-status",
    {}
  );

  return (
    <div style={{ padding: "1rem", maxWidth: 600 }}>
      <h2>X Scanner Settings</h2>

      <section style={{ marginTop: "1rem" }}>
        <h3>Status</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div>
            <p>
              <strong>Last scan:</strong>{" "}
              {status?.lastScanAt
                ? new Date(status.lastScanAt).toLocaleString()
                : "Never"}
            </p>
            <p>
              <strong>Scan running:</strong>{" "}
              {status?.scanRunning ? "Yes" : "No"}
            </p>
            <button onClick={refresh}>Refresh</button>
          </div>
        )}
      </section>

      <section style={{ marginTop: "1rem" }}>
        <h3>Configuration</h3>
        <p>
          Configure members, API keys, and scan interval in the plugin
          configuration panel.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Build the plugin**

```bash
cd plugin-x-scanner
pnpm build
```

Expected: `dist/` directory created with `manifest.js`, `worker.js`, and `ui/` folder.

- [ ] **Step 3: Run full verification**

```bash
pnpm typecheck && pnpm test && pnpm build
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add plugin-x-scanner/src/ui/index.tsx
git commit -m "feat(x-scanner): add settings UI page"
```

---

## Task 6: X Scanner — Install and Verify

- [ ] **Step 1: Install plugin into local Paperclip**

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d "{\"packageName\":\"$(pwd)/plugin-x-scanner\",\"isLocalPath\":true}"
```

Expected: `200 OK` with plugin status.

- [ ] **Step 2: Verify plugin appears in Paperclip UI**

Open Paperclip UI → Settings → Plugins. Confirm "X Post Scanner" is listed and `ready`.

- [ ] **Step 3: Configure plugin**

Set config values: `rapidApiKey`, `supabaseUrl`, `supabaseServiceKey`, `members` array.

- [ ] **Step 4: Trigger manual scan**

Wait for next cron cycle or trigger manually. Check Supabase `x_posts` table for new rows.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "fix(x-scanner): post-install fixes"
```

---

## Task 7: Scaffold Plugin 2 — Polymarket Scanner

**Files:**
- Create: `plugin-polymarket-scanner/package.json`
- Create: `plugin-polymarket-scanner/tsconfig.json`
- Create: `plugin-polymarket-scanner/vitest.config.ts`
- Create: `plugin-polymarket-scanner/esbuild.config.mjs`
- Create: `plugin-polymarket-scanner/src/types.ts`
- Create: `plugin-polymarket-scanner/src/manifest.ts`

- [ ] **Step 1: Create project directory and package.json**

```bash
mkdir -p plugin-polymarket-scanner/src/ui plugin-polymarket-scanner/tests
```

```json
{
  "name": "@yourscope/plugin-polymarket-scanner",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "paperclipPlugin": {
    "manifest": "./dist/manifest.js",
    "worker": "./dist/worker.js",
    "ui": "./dist/ui/"
  },
  "scripts": {
    "build": "node ./esbuild.config.mjs",
    "dev": "node ./esbuild.config.mjs --watch",
    "test": "vitest run --config ./vitest.config.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0"
  },
  "devDependencies": {
    "@paperclipai/plugin-sdk": "workspace:*",
    "esbuild": "^0.25.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Copy tsconfig.json, vitest.config.ts, esbuild.config.mjs from plugin-x-scanner** (identical files)

- [ ] **Step 3: Create src/types.ts**

```typescript
export interface PolymarketConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  keywords: string[];
  minVolume: number;
  minAiRelevanceScore: number;
  scanIntervalMinutes: number;
  agentSlug: string;
  companyId: string;
}

export interface Market {
  market_id: string;
  question: string;
  description: string | null;
  category: string | null;
  outcome_prices: Record<string, number>;
  volume: number;
  liquidity: number;
  end_date: string | null;
  status: string;
  url: string | null;
  raw_data: unknown;
}

export interface AnalyzedMarket extends Market {
  matched_keywords: string[];
  ai_relevance_score: number | null;
  ai_analysis: string | null;
}

export interface GammaMarket {
  id: string;
  question: string;
  description: string;
  category: string;
  outcomes: string[];
  outcomePrices: string[];
  volume: string;
  liquidity: string;
  endDate: string;
  active: boolean;
  closed: boolean;
  slug: string;
}

export interface MarketEventPayload {
  markets: Array<{
    market_id: string;
    question: string;
    outcome_prices: Record<string, number>;
    ai_relevance_score: number;
    ai_analysis: string;
    url: string;
  }>;
}
```

- [ ] **Step 4: Create src/manifest.ts**

```typescript
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "yourscope.plugin-polymarket-scanner",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Polymarket Scanner",
  description: "Scans Polymarket via Gamma API, uses AI to analyze relevance, saves to Supabase, and triggers notifications",
  author: "yourscope",
  categories: ["connector", "automation"],
  capabilities: [
    "http.outbound",
    "jobs.schedule",
    "plugin.state.read",
    "plugin.state.write",
    "secrets.read-ref",
    "events.emit",
    "agents.read",
    "agent.sessions.create",
    "agent.sessions.send",
    "activity.log.write",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  jobs: [
    {
      jobKey: "scan-polymarket",
      displayName: "Scan Polymarket Markets",
      description: "Fetch and analyze markets from Polymarket via Gamma API",
      schedule: "0 * * * *",
    },
  ],
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: "polymarket-scanner-settings",
        displayName: "Polymarket Scanner Settings",
        exportName: "PolymarketScannerSettings",
      },
    ],
  },
};

export default manifest;
```

- [ ] **Step 5: Install dependencies and typecheck**

```bash
cd plugin-polymarket-scanner
pnpm install
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add plugin-polymarket-scanner/
git commit -m "feat: scaffold plugin-polymarket-scanner package"
```

---

## Task 8: Polymarket Scanner — Core Scanner Logic

**Files:**
- Create: `plugin-polymarket-scanner/src/scanner.ts`
- Create: `plugin-polymarket-scanner/tests/scanner.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/scanner.spec.ts
import { describe, it, expect, vi } from "vitest";
import {
  fetchMarkets,
  mapGammaMarket,
  filterByVolume,
  dedup,
} from "../src/scanner.js";

describe("mapGammaMarket", () => {
  it("maps Gamma API response to Market format", () => {
    const gamma = {
      id: "0x123",
      question: "Will BTC hit 100k?",
      description: "Bitcoin price prediction",
      category: "Crypto",
      outcomes: ["Yes", "No"],
      outcomePrices: ["0.72", "0.28"],
      volume: "125000",
      liquidity: "50000",
      endDate: "2026-07-01T00:00:00Z",
      active: true,
      closed: false,
      slug: "will-btc-hit-100k",
    };

    const market = mapGammaMarket(gamma);

    expect(market.market_id).toBe("0x123");
    expect(market.question).toBe("Will BTC hit 100k?");
    expect(market.outcome_prices).toEqual({ Yes: 0.72, No: 0.28 });
    expect(market.volume).toBe(125000);
    expect(market.url).toBe("https://polymarket.com/event/will-btc-hit-100k");
  });
});

describe("filterByVolume", () => {
  it("filters markets below minVolume", () => {
    const markets = [
      { market_id: "a", volume: 500 },
      { market_id: "b", volume: 2000 },
      { market_id: "c", volume: 1000 },
    ] as any[];

    const result = filterByVolume(markets, 1000);
    expect(result).toHaveLength(2);
    expect(result.map((m: any) => m.market_id)).toEqual(["b", "c"]);
  });
});

describe("dedup", () => {
  it("removes duplicate market_ids", () => {
    const markets = [
      { market_id: "a", question: "Q1" },
      { market_id: "b", question: "Q2" },
      { market_id: "a", question: "Q1 duplicate" },
    ] as any[];

    const result = dedup(markets);
    expect(result).toHaveLength(2);
  });
});

describe("fetchMarkets", () => {
  it("calls Gamma API for each keyword and merges results", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: "0x1",
          question: "BTC question",
          description: "",
          category: "Crypto",
          outcomes: ["Yes", "No"],
          outcomePrices: ["0.6", "0.4"],
          volume: "5000",
          liquidity: "2000",
          endDate: "2026-12-31",
          active: true,
          closed: false,
          slug: "btc-question",
        },
      ],
    });

    const markets = await fetchMarkets(mockFetch, ["Bitcoin", "Crypto"]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Deduped: same market returned for both keywords
    expect(markets.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

- [ ] **Step 3: Implement scanner.ts**

```typescript
// src/scanner.ts
import type { Market, GammaMarket } from "./types.js";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export function mapGammaMarket(g: GammaMarket): Market {
  const prices: Record<string, number> = {};
  g.outcomes.forEach((outcome, i) => {
    prices[outcome] = parseFloat(g.outcomePrices[i] ?? "0");
  });

  return {
    market_id: g.id,
    question: g.question,
    description: g.description || null,
    category: g.category || null,
    outcome_prices: prices,
    volume: parseFloat(g.volume) || 0,
    liquidity: parseFloat(g.liquidity) || 0,
    end_date: g.endDate || null,
    status: g.closed ? "closed" : g.active ? "active" : "inactive",
    url: g.slug ? `https://polymarket.com/event/${g.slug}` : null,
    raw_data: g,
  };
}

export function filterByVolume(markets: Market[], minVolume: number): Market[] {
  return markets.filter((m) => m.volume >= minVolume);
}

export function dedup(markets: Market[]): Market[] {
  const seen = new Set<string>();
  return markets.filter((m) => {
    if (seen.has(m.market_id)) return false;
    seen.add(m.market_id);
    return true;
  });
}

export async function fetchMarkets(
  fetch: FetchFn,
  keywords: string[]
): Promise<Market[]> {
  const allMarkets: Market[] = [];

  for (const keyword of keywords) {
    const url = `${GAMMA_API_BASE}/markets?tag=${encodeURIComponent(keyword)}&active=true&closed=false&limit=100`;

    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      continue;
    }

    const data = (await response.json()) as GammaMarket[];
    allMarkets.push(...data.map(mapGammaMarket));
  }

  return dedup(allMarkets);
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin-polymarket-scanner/src/scanner.ts plugin-polymarket-scanner/tests/scanner.spec.ts
git commit -m "feat(polymarket): add core scanner with Gamma API integration"
```

---

## Task 9: Polymarket Scanner — AI Analyzer

**Files:**
- Create: `plugin-polymarket-scanner/src/analyzer.ts`
- Create: `plugin-polymarket-scanner/tests/analyzer.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/analyzer.spec.ts
import { describe, it, expect } from "vitest";
import { buildAnalysisPrompt, parseAnalysisResponse } from "../src/analyzer.js";
import type { Market } from "../src/types.js";

describe("buildAnalysisPrompt", () => {
  it("builds a prompt with markets and keywords", () => {
    const markets: Market[] = [
      {
        market_id: "0x1",
        question: "Will BTC hit 100k?",
        description: "Bitcoin price",
        category: "Crypto",
        outcome_prices: { Yes: 0.7, No: 0.3 },
        volume: 5000,
        liquidity: 2000,
        end_date: null,
        status: "active",
        url: null,
        raw_data: {},
      },
    ];

    const prompt = buildAnalysisPrompt(markets, ["Bitcoin", "Crypto"]);

    expect(prompt).toContain("Will BTC hit 100k?");
    expect(prompt).toContain("Bitcoin");
    expect(prompt).toContain("Crypto");
    expect(prompt).toContain("0x1");
    expect(prompt).toContain("JSON");
  });
});

describe("parseAnalysisResponse", () => {
  it("parses valid JSON response", () => {
    const response = JSON.stringify({
      results: [
        {
          market_id: "0x1",
          relevance_score: 0.85,
          analysis: "Highly relevant to crypto topic",
        },
      ],
    });

    const parsed = parseAnalysisResponse(response);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].market_id).toBe("0x1");
    expect(parsed[0].relevance_score).toBe(0.85);
    expect(parsed[0].analysis).toBe("Highly relevant to crypto topic");
  });

  it("returns empty array for invalid JSON", () => {
    const parsed = parseAnalysisResponse("not json at all");
    expect(parsed).toEqual([]);
  });

  it("extracts JSON from markdown code block", () => {
    const response = '```json\n{"results":[{"market_id":"0x1","relevance_score":0.9,"analysis":"test"}]}\n```';
    const parsed = parseAnalysisResponse(response);
    expect(parsed).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

- [ ] **Step 3: Implement analyzer.ts**

```typescript
// src/analyzer.ts
import type { Market } from "./types.js";

export interface AnalysisResult {
  market_id: string;
  relevance_score: number;
  analysis: string;
}

export function buildAnalysisPrompt(
  markets: Market[],
  keywords: string[]
): string {
  const marketList = markets
    .map(
      (m) =>
        `- ID: ${m.market_id}\n  Question: ${m.question}\n  Description: ${m.description ?? "N/A"}\n  Category: ${m.category ?? "N/A"}\n  Odds: ${JSON.stringify(m.outcome_prices)}`
    )
    .join("\n\n");

  return `Analyze the following Polymarket markets for relevance to these topics: ${keywords.join(", ")}

For each market, rate its relevance from 0 to 1 and provide a brief analysis explaining why.

Markets:
${marketList}

Respond with JSON in this exact format:
{
  "results": [
    {
      "market_id": "<id>",
      "relevance_score": <0-1>,
      "analysis": "<brief reasoning>"
    }
  ]
}`;
}

export function parseAnalysisResponse(response: string): AnalysisResult[] {
  try {
    // Try to extract JSON from markdown code block
    const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1] : response;

    const parsed = JSON.parse(jsonStr.trim());
    if (!parsed.results || !Array.isArray(parsed.results)) {
      return [];
    }

    return parsed.results.map((r: any) => ({
      market_id: String(r.market_id),
      relevance_score: Number(r.relevance_score) || 0,
      analysis: String(r.analysis || ""),
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add plugin-polymarket-scanner/src/analyzer.ts plugin-polymarket-scanner/tests/analyzer.spec.ts
git commit -m "feat(polymarket): add AI analyzer with prompt builder and response parser"
```

---

## Task 10: Polymarket Scanner — Supabase Client

**Files:**
- Create: `plugin-polymarket-scanner/src/supabase.ts`
- Create: `plugin-polymarket-scanner/tests/supabase.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/supabase.spec.ts
import { describe, it, expect, vi } from "vitest";
import { upsertMarkets, updateNotifiedAt } from "../src/supabase.js";
import type { AnalyzedMarket } from "../src/types.js";

describe("upsertMarkets", () => {
  it("calls supabase upsert with analyzed markets", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
    const mockClient = { from: mockFrom } as any;

    const markets: AnalyzedMarket[] = [
      {
        market_id: "0x1",
        question: "Test?",
        description: null,
        category: "Crypto",
        outcome_prices: { Yes: 0.7, No: 0.3 },
        volume: 5000,
        liquidity: 2000,
        end_date: null,
        status: "active",
        url: "https://polymarket.com/event/test",
        raw_data: {},
        matched_keywords: ["Bitcoin"],
        ai_relevance_score: 0.85,
        ai_analysis: "Relevant",
      },
    ];

    await upsertMarkets(mockClient, markets);

    expect(mockFrom).toHaveBeenCalledWith("polymarket_markets");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ market_id: "0x1", ai_relevance_score: 0.85 }),
      ]),
      { onConflict: "market_id" }
    );
  });
});

describe("updateNotifiedAt", () => {
  it("updates notified_at for given market IDs", async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockIn = vi.fn().mockReturnValue({ eq: mockEq });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    const mockClient = { from: mockFrom } as any;

    await updateNotifiedAt(mockClient, ["0x1", "0x2"]);

    expect(mockFrom).toHaveBeenCalledWith("polymarket_markets");
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

- [ ] **Step 3: Implement supabase.ts**

```typescript
// src/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AnalyzedMarket } from "./types.js";

export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key);
}

export async function upsertMarkets(
  client: SupabaseClient,
  markets: AnalyzedMarket[]
): Promise<{ error: string | null }> {
  if (markets.length === 0) return { error: null };

  const rows = markets.map((m) => ({
    market_id: m.market_id,
    question: m.question,
    description: m.description,
    category: m.category,
    outcome_prices: m.outcome_prices,
    volume: m.volume,
    liquidity: m.liquidity,
    end_date: m.end_date,
    status: m.status,
    matched_keywords: m.matched_keywords,
    ai_relevance_score: m.ai_relevance_score,
    ai_analysis: m.ai_analysis,
    url: m.url,
    raw_data: m.raw_data,
    last_scanned_at: new Date().toISOString(),
  }));

  const { error } = await client
    .from("polymarket_markets")
    .upsert(rows, { onConflict: "market_id" });

  return { error: error?.message ?? null };
}

export async function updateNotifiedAt(
  client: SupabaseClient,
  marketIds: string[]
): Promise<void> {
  if (marketIds.length === 0) return;

  await client
    .from("polymarket_markets")
    .update({ notified_at: new Date().toISOString() })
    .in("market_id", marketIds);
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add plugin-polymarket-scanner/src/supabase.ts plugin-polymarket-scanner/tests/supabase.spec.ts
git commit -m "feat(polymarket): add Supabase client for market upsert"
```

---

## Task 11: Polymarket Scanner — Worker

**Files:**
- Create: `plugin-polymarket-scanner/src/worker.ts`
- Create: `plugin-polymarket-scanner/tests/worker.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/worker.spec.ts
import { describe, it, expect } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

describe("Polymarket Scanner worker", () => {
  it("sets up without error", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });

    await plugin.definition.setup(harness.ctx);

    const health = await plugin.definition.onHealth!();
    expect(health.status).toBe("ok");
  });

  it("registers scan-polymarket job handler", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });

    await plugin.definition.setup(harness.ctx);

    expect(harness.logs.some((l) => l.message.includes("setup"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

- [ ] **Step 3: Implement worker.ts**

```typescript
// src/worker.ts
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginJobContext } from "@paperclipai/plugin-sdk";
import { fetchMarkets, filterByVolume } from "./scanner.js";
import { buildAnalysisPrompt, parseAnalysisResponse } from "./analyzer.js";
import {
  createSupabaseClient,
  upsertMarkets,
  updateNotifiedAt,
} from "./supabase.js";
import type { PolymarketConfig, AnalyzedMarket, MarketEventPayload } from "./types.js";

const PLUGIN_NAME = "polymarket-scanner";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup complete`);

    ctx.jobs.register("scan-polymarket", async (job: PluginJobContext) => {
      const scanRunning = await ctx.state.get({
        scopeKind: "instance",
        stateKey: "scanRunning",
      });
      if (scanRunning) {
        ctx.logger.info("Scan already running, skipping");
        return;
      }

      try {
        await ctx.state.set(
          { scopeKind: "instance", stateKey: "scanRunning" },
          true
        );

        const config = (await ctx.config.get()) as PolymarketConfig;
        if (!config?.keywords?.length) {
          ctx.logger.warn("No keywords configured, skipping");
          return;
        }

        const supabase = createSupabaseClient(
          config.supabaseUrl,
          await ctx.secrets.resolve(config.supabaseServiceKey)
        );

        // Phase 1: Keyword filter
        const rawMarkets = await fetchMarkets(
          ctx.http.fetch.bind(ctx.http),
          config.keywords
        );
        const filtered = filterByVolume(rawMarkets, config.minVolume ?? 1000);

        if (filtered.length === 0) {
          ctx.logger.info("No markets found matching criteria");
          return;
        }

        // Phase 2: AI analyze
        let analyzedMarkets: AnalyzedMarket[] = filtered.map((m) => ({
          ...m,
          matched_keywords: config.keywords,
          ai_relevance_score: null,
          ai_analysis: null,
        }));

        try {
          const agents = await ctx.agents.list({
            companyId: config.companyId,
            limit: 100,
            offset: 0,
          });
          const agent = agents.find(
            (a: any) => a.slug === config.agentSlug
          );

          if (agent) {
            const prompt = buildAnalysisPrompt(filtered, config.keywords);

            // Use agent sessions for bidirectional communication
            const session = await ctx.agents.sessions.create(
              agent.id,
              config.companyId,
              { reason: "Polymarket market analysis" }
            );

            // Collect the full response via streaming
            let fullResponse = "";
            await ctx.agents.sessions.sendMessage(
              session.sessionId,
              config.companyId,
              {
                prompt,
                reason: "Analyze market relevance",
                onEvent: (event) => {
                  if (event.eventType === "chunk" && event.message) {
                    fullResponse += event.message;
                  }
                },
              }
            );

            const analysisResults = parseAnalysisResponse(fullResponse);

            for (const ar of analysisResults) {
              const market = analyzedMarkets.find(
                (m) => m.market_id === ar.market_id
              );
              if (market) {
                market.ai_relevance_score = ar.relevance_score;
                market.ai_analysis = ar.analysis;
              }
            }
          } else {
            ctx.logger.warn(
              `Agent ${config.agentSlug} not found, saving without AI analysis`
            );
          }
        } catch (err) {
          ctx.logger.error("AI analysis failed, saving without scores", {
            error: String(err),
          });
        }

        // Phase 3: Save all markets
        const upsertResult = await upsertMarkets(supabase, analyzedMarkets);
        if (upsertResult.error) {
          ctx.logger.error("Supabase upsert failed", {
            error: upsertResult.error,
          });
          return;
        }

        // Emit event for new relevant markets (not previously notified)
        const threshold = config.minAiRelevanceScore ?? 0.6;
        const relevantCandidates = analyzedMarkets.filter(
          (m) =>
            m.ai_relevance_score !== null &&
            m.ai_relevance_score >= threshold
        );

        // Check which markets were already notified (dedup)
        let relevantNew = relevantCandidates;
        if (relevantCandidates.length > 0) {
          const { data: existing } = await supabase
            .from("polymarket_markets")
            .select("market_id")
            .in("market_id", relevantCandidates.map((m) => m.market_id))
            .not("notified_at", "is", null);

          const alreadyNotified = new Set(
            (existing ?? []).map((r: any) => r.market_id)
          );
          relevantNew = relevantCandidates.filter(
            (m) => !alreadyNotified.has(m.market_id)
          );
        }

        if (relevantNew.length > 0) {
          const payload: MarketEventPayload = {
            markets: relevantNew.map((m) => ({
              market_id: m.market_id,
              question: m.question,
              outcome_prices: m.outcome_prices,
              ai_relevance_score: m.ai_relevance_score!,
              ai_analysis: m.ai_analysis ?? "",
              url: m.url ?? "",
            })),
          };

          await ctx.events.emit("new_markets", config.companyId, payload);

          // Mark as notified
          await updateNotifiedAt(
            supabase,
            relevantNew.map((m) => m.market_id)
          );
        }

        await ctx.state.set(
          { scopeKind: "instance", stateKey: "lastScanAt" },
          new Date().toISOString()
        );

        await ctx.activity.log({
          companyId: config.companyId,
          message: `Scanned Polymarket: ${filtered.length} markets, ${relevantNew.length} new relevant`,
          metadata: {
            plugin: PLUGIN_NAME,
            total: filtered.length,
            relevant: relevantNew.length,
          },
        });
      } finally {
        await ctx.state.set(
          { scopeKind: "instance", stateKey: "scanRunning" },
          false
        );
      }
    });

    // Data handler for UI
    ctx.data.register(
      "scanner-status",
      async (params: Record<string, unknown>) => {
        const lastScanAt = await ctx.state.get({
          scopeKind: "instance",
          stateKey: "lastScanAt",
        });
        const scanRunning = await ctx.state.get({
          scopeKind: "instance",
          stateKey: "scanRunning",
        });
        return { lastScanAt: lastScanAt ?? null, scanRunning: !!scanRunning };
      }
    );
  },

  async onHealth() {
    return { status: "ok", message: "Polymarket Scanner plugin ready" };
  },

  async onValidateConfig(config: Record<string, unknown>) {
    const errors: string[] = [];
    if (!config.supabaseUrl) errors.push("supabaseUrl is required");
    if (!config.supabaseServiceKey) errors.push("supabaseServiceKey is required");
    if (!config.keywords || !Array.isArray(config.keywords) || config.keywords.length === 0)
      errors.push("keywords must be a non-empty array");
    if (!config.agentSlug) errors.push("agentSlug is required");
    if (!config.companyId) errors.push("companyId is required");
    return { ok: errors.length === 0, errors };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

- [ ] **Step 5: Create settings UI**

```tsx
// src/ui/index.tsx
import {
  usePluginData,
  useHostContext,
  type PluginSettingsPageProps,
} from "@paperclipai/plugin-sdk/ui";

interface ScannerStatus {
  lastScanAt: string | null;
  scanRunning: boolean;
}

export function PolymarketScannerSettings({ context }: PluginSettingsPageProps) {
  const { data: status, loading, refresh } = usePluginData<ScannerStatus>(
    "scanner-status",
    {}
  );

  return (
    <div style={{ padding: "1rem", maxWidth: 600 }}>
      <h2>Polymarket Scanner Settings</h2>
      <section style={{ marginTop: "1rem" }}>
        <h3>Status</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div>
            <p><strong>Last scan:</strong> {status?.lastScanAt ? new Date(status.lastScanAt).toLocaleString() : "Never"}</p>
            <p><strong>Scan running:</strong> {status?.scanRunning ? "Yes" : "No"}</p>
            <button onClick={refresh}>Refresh</button>
          </div>
        )}
      </section>
      <section style={{ marginTop: "1rem" }}>
        <h3>Configuration</h3>
        <p>Configure keywords, thresholds, agent, and API keys in the plugin configuration panel.</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Build and verify**

```bash
pnpm typecheck && pnpm test && pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add plugin-polymarket-scanner/
git commit -m "feat(polymarket): add worker, UI, and full scan pipeline"
```

---

## Task 12: Scaffold Plugin 3 — Telegram Notifier

**Files:**
- Create: `plugin-telegram-notifier/` (full scaffold)

- [ ] **Step 1: Create project scaffold**

Same structure as previous plugins. `package.json`:

```json
{
  "name": "@yourscope/plugin-telegram-notifier",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "paperclipPlugin": {
    "manifest": "./dist/manifest.js",
    "worker": "./dist/worker.js",
    "ui": "./dist/ui/"
  },
  "scripts": {
    "build": "node ./esbuild.config.mjs",
    "dev": "node ./esbuild.config.mjs --watch",
    "test": "vitest run --config ./vitest.config.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.0"
  },
  "devDependencies": {
    "@paperclipai/plugin-sdk": "workspace:*",
    "esbuild": "^0.25.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create src/types.ts**

```typescript
export interface TelegramConfig {
  botToken: string;
  chatId: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
}

export interface MarketAlert {
  market_id: string;
  question: string;
  outcome_prices: Record<string, number>;
  ai_relevance_score: number;
  ai_analysis: string;
  url: string;
}

export interface MarketEventPayload {
  markets: MarketAlert[];
}
```

- [ ] **Step 3: Create src/manifest.ts**

```typescript
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "yourscope.plugin-telegram-notifier",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Telegram Notifier",
  description: "Sends Polymarket alerts to a Telegram group via bot",
  author: "yourscope",
  categories: ["connector"],
  capabilities: [
    "http.outbound",
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "secrets.read-ref",
    "activity.log.write",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      {
        type: "settingsPage",
        id: "telegram-notifier-settings",
        displayName: "Telegram Notifier Settings",
        exportName: "TelegramNotifierSettings",
      },
    ],
  },
};

export default manifest;
```

- [ ] **Step 4: Copy tsconfig.json, vitest.config.ts, esbuild.config.mjs**

- [ ] **Step 5: Install and typecheck**

```bash
cd plugin-telegram-notifier && pnpm install && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add plugin-telegram-notifier/
git commit -m "feat: scaffold plugin-telegram-notifier package"
```

---

## Task 13: Telegram Notifier — Core Logic

**Files:**
- Create: `plugin-telegram-notifier/src/notifier.ts`
- Create: `plugin-telegram-notifier/tests/notifier.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/notifier.spec.ts
import { describe, it, expect, vi } from "vitest";
import { formatMarketMessage, sendTelegramMessage } from "../src/notifier.js";
import type { MarketAlert } from "../src/types.js";

describe("formatMarketMessage", () => {
  it("formats a market alert as text", () => {
    const market: MarketAlert = {
      market_id: "0x1",
      question: "Will BTC hit 100k?",
      outcome_prices: { Yes: 0.72, No: 0.28 },
      ai_relevance_score: 0.85,
      ai_analysis: "Highly relevant",
      url: "https://polymarket.com/event/btc-100k",
    };

    const msg = formatMarketMessage(market);

    expect(msg).toContain("Will BTC hit 100k?");
    expect(msg).toContain("72%");
    expect(msg).toContain("28%");
    expect(msg).toContain("0.85");
    expect(msg).toContain("https://polymarket.com/event/btc-100k");
  });
});

describe("sendTelegramMessage", () => {
  it("calls Telegram API with correct params", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await sendTelegramMessage(mockFetch, "bot123", "-100123", "Hello");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botbot123/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Hello"),
      })
    );
  });

  it("throws on Telegram API error after retries", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(
      sendTelegramMessage(mockFetch, "bot123", "-100123", "Hello", 1)
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

- [ ] **Step 3: Implement notifier.ts**

```typescript
// src/notifier.ts
import type { MarketAlert } from "./types.js";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export function formatMarketMessage(market: MarketAlert): string {
  const prices = Object.entries(market.outcome_prices)
    .map(([outcome, price]) => `${outcome}: ${Math.round(price * 100)}%`)
    .join(" | ");

  return [
    `New Polymarket Alert`,
    ``,
    `Q: ${market.question}`,
    prices,
    `AI Score: ${market.ai_relevance_score}`,
    ``,
    market.url,
  ].join("\n");
}

export async function sendTelegramMessage(
  fetch: FetchFn,
  botToken: string,
  chatId: string,
  text: string,
  maxRetries: number = 3
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    if (response.ok) return;

    if (attempt === maxRetries) {
      throw new Error(
        `Telegram API failed after ${maxRetries} attempts: ${response.status} ${response.statusText}`
      );
    }

    // Exponential backoff: 1s, 2s, 4s
    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
  }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add plugin-telegram-notifier/src/notifier.ts plugin-telegram-notifier/tests/notifier.spec.ts
git commit -m "feat(telegram): add message formatter and sender with retry"
```

---

## Task 14: Telegram Notifier — Worker + UI

**Files:**
- Create: `plugin-telegram-notifier/src/supabase.ts`
- Create: `plugin-telegram-notifier/src/worker.ts`
- Create: `plugin-telegram-notifier/src/ui/index.tsx`
- Create: `plugin-telegram-notifier/tests/worker.spec.ts`

- [ ] **Step 1: Create supabase.ts**

```typescript
// src/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key);
}

export async function updateNotifiedAt(
  client: SupabaseClient,
  marketIds: string[]
): Promise<void> {
  if (marketIds.length === 0) return;

  await client
    .from("polymarket_markets")
    .update({ notified_at: new Date().toISOString() })
    .in("market_id", marketIds);
}
```

- [ ] **Step 2: Create worker.ts**

```typescript
// src/worker.ts
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { PluginEvent } from "@paperclipai/plugin-sdk";
import { formatMarketMessage, sendTelegramMessage } from "./notifier.js";
import { createSupabaseClient, updateNotifiedAt } from "./supabase.js";
import type { TelegramConfig, MarketEventPayload } from "./types.js";

const PLUGIN_NAME = "telegram-notifier";
const POLYMARKET_EVENT = "plugin.yourscope.plugin-polymarket-scanner.new_markets";
const RATE_LIMIT_DELAY_MS = 3000; // 20 msgs/min = 1 per 3 seconds

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup complete`);

    ctx.events.on(POLYMARKET_EVENT, async (event: PluginEvent) => {
      const config = (await ctx.config.get()) as TelegramConfig;
      if (!config?.botToken || !config?.chatId) {
        ctx.logger.warn("Telegram config missing, skipping notification");
        return;
      }

      const botToken = await ctx.secrets.resolve(config.botToken);
      const payload = event.payload as MarketEventPayload;

      if (!payload?.markets?.length) return;

      const supabase = createSupabaseClient(
        config.supabaseUrl,
        await ctx.secrets.resolve(config.supabaseServiceKey)
      );

      const notifiedIds: string[] = [];
      let sentCount = 0;

      for (const market of payload.markets) {
        try {
          const message = formatMarketMessage(market);

          await sendTelegramMessage(
            ctx.http.fetch.bind(ctx.http),
            botToken,
            config.chatId,
            message
          );

          notifiedIds.push(market.market_id);
          sentCount++;

          // Rate limit: wait between messages
          if (sentCount < payload.markets.length) {
            await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
          }
        } catch (err) {
          ctx.logger.error(`Failed to send notification for ${market.market_id}`, {
            error: String(err),
          });
        }
      }

      // Update notified_at in Supabase
      if (notifiedIds.length > 0) {
        try {
          await updateNotifiedAt(supabase, notifiedIds);
        } catch (err) {
          ctx.logger.warn("Failed to update notified_at in Supabase", {
            error: String(err),
          });
        }
      }

      // Update lastSentAt state for UI display
      if (sentCount > 0) {
        await ctx.state.set(
          { scopeKind: "instance", stateKey: "lastSentAt" },
          new Date().toISOString()
        );
      }

      await ctx.activity.log({
        companyId: event.companyId,
        message: `Sent ${sentCount} notifications to Telegram`,
        metadata: { plugin: PLUGIN_NAME, sent: sentCount, total: payload.markets.length },
      });
    });

    // Data handler for UI
    ctx.data.register(
      "notifier-status",
      async (params: Record<string, unknown>) => {
        const lastSentAt = await ctx.state.get({
          scopeKind: "instance",
          stateKey: "lastSentAt",
        });
        return { lastSentAt: lastSentAt ?? null };
      }
    );

    // Action handler: test send
    ctx.actions.register(
      "test-send",
      async (params: Record<string, unknown>) => {
        const config = (await ctx.config.get()) as TelegramConfig;
        const botToken = await ctx.secrets.resolve(config.botToken);

        await sendTelegramMessage(
          ctx.http.fetch.bind(ctx.http),
          botToken,
          config.chatId,
          "Test message from Paperclip Telegram Notifier plugin"
        );

        return { ok: true };
      }
    );
  },

  async onHealth() {
    return { status: "ok", message: "Telegram Notifier plugin ready" };
  },

  async onValidateConfig(config: Record<string, unknown>) {
    const errors: string[] = [];
    if (!config.botToken) errors.push("botToken is required");
    if (!config.chatId) errors.push("chatId is required");
    if (!config.supabaseUrl) errors.push("supabaseUrl is required");
    if (!config.supabaseServiceKey) errors.push("supabaseServiceKey is required");
    return { ok: errors.length === 0, errors };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

- [ ] **Step 3: Create UI**

```tsx
// src/ui/index.tsx
import {
  usePluginData,
  usePluginAction,
  usePluginToast,
  type PluginSettingsPageProps,
} from "@paperclipai/plugin-sdk/ui";

interface NotifierStatus {
  lastSentAt: string | null;
}

export function TelegramNotifierSettings({ context }: PluginSettingsPageProps) {
  const toast = usePluginToast();
  const { data: status, loading, refresh } = usePluginData<NotifierStatus>(
    "notifier-status",
    {}
  );
  const testSend = usePluginAction("test-send");

  const handleTestSend = async () => {
    try {
      await testSend({});
      toast("info", "Test message sent to Telegram");
    } catch (err) {
      toast("error", `Failed: ${String(err)}`);
    }
  };

  return (
    <div style={{ padding: "1rem", maxWidth: 600 }}>
      <h2>Telegram Notifier Settings</h2>
      <section style={{ marginTop: "1rem" }}>
        <h3>Status</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <p>
            <strong>Last sent:</strong>{" "}
            {status?.lastSentAt
              ? new Date(status.lastSentAt).toLocaleString()
              : "Never"}
          </p>
        )}
      </section>
      <section style={{ marginTop: "1rem" }}>
        <button onClick={handleTestSend}>Send Test Message</button>
        <button onClick={refresh} style={{ marginLeft: "0.5rem" }}>Refresh</button>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Write worker test**

```typescript
// tests/worker.spec.ts
import { describe, it, expect } from "vitest";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

describe("Telegram Notifier worker", () => {
  it("sets up without error", async () => {
    const harness = createTestHarness({
      manifest,
      capabilities: manifest.capabilities,
    });

    await plugin.definition.setup(harness.ctx);

    const health = await plugin.definition.onHealth!();
    expect(health.status).toBe("ok");
  });
});
```

- [ ] **Step 5: Build and verify**

```bash
pnpm typecheck && pnpm test && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add plugin-telegram-notifier/
git commit -m "feat(telegram): add worker with event subscription, notifier, and settings UI"
```

---

## Task 15: Integration Test — Full Pipeline

- [ ] **Step 1: Install all 3 plugins into Paperclip**

```bash
# From project root
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d "{\"packageName\":\"$(pwd)/plugin-x-scanner\",\"isLocalPath\":true}"

curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d "{\"packageName\":\"$(pwd)/plugin-polymarket-scanner\",\"isLocalPath\":true}"

curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d "{\"packageName\":\"$(pwd)/plugin-telegram-notifier\",\"isLocalPath\":true}"
```

- [ ] **Step 2: Verify all plugins show as "ready" in Paperclip UI**

- [ ] **Step 3: Configure X Scanner** — set RapidAPI key, Supabase credentials, add a member

- [ ] **Step 4: Configure Polymarket Scanner** — set keywords, Supabase credentials, agent slug, company ID

- [ ] **Step 5: Configure Telegram Notifier** — set bot token, chat ID, Supabase credentials

- [ ] **Step 6: Test X Scanner** — wait for cron or trigger manually, check Supabase `x_posts`

- [ ] **Step 7: Test Polymarket Scanner** — wait for cron, check Supabase `polymarket_markets`

- [ ] **Step 8: Test Telegram Notifier** — verify message received in Telegram group after Polymarket scan finds relevant markets

- [ ] **Step 9: Test Telegram send button** — click "Send Test Message" in Telegram Notifier settings

- [ ] **Step 10: Commit final state**

```bash
git add -A && git commit -m "feat: complete scanner plugins pipeline — all 3 plugins verified"
```

---

## Task 16: README and Publishing

- [ ] **Step 1: Create README.md for each plugin**

Each README should include: description, prerequisites, installation, configuration fields, Supabase schema setup, and usage.

- [ ] **Step 2: Copy supabase-schema.sql into each plugin that needs it**

- `plugin-x-scanner/supabase-schema.sql` (x_posts table only)
- `plugin-polymarket-scanner/supabase-schema.sql` (polymarket_markets table only)

- [ ] **Step 3: Update package.json `private: false` for publishing**

- [ ] **Step 4: Publish to npm**

```bash
cd plugin-x-scanner && npm publish --access public
cd plugin-polymarket-scanner && npm publish --access public
cd plugin-telegram-notifier && npm publish --access public
```

- [ ] **Step 5: Verify friends can install**

```bash
paperclipai plugin install @yourscope/plugin-x-scanner
paperclipai plugin install @yourscope/plugin-polymarket-scanner
paperclipai plugin install @yourscope/plugin-telegram-notifier
```

- [ ] **Step 6: Final commit**

```bash
git add -A && git commit -m "docs: add READMEs and prepare plugins for npm publishing"
```
