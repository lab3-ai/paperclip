# Plugin Publishing, Marketplace & Config UI Design

Status: approved
Date: 2026-03-24

## Overview

Three changes to make the 3 scanner plugins (X Scanner, Polymarket Scanner, Telegram Notifier) installable by friends and configurable via UI.

1. **Publish to npm** under `@lab3-ai` scope
2. **Add to Available Plugins list** in Paperclip UI (hardcoded)
3. **Add `instanceConfigSchema`** to manifests for auto-generated config forms

---

## Feature 1: Publish to npm (`@lab3-ai`)

### Package Renames

| Current | New |
|---------|-----|
| `@paperclipai/plugin-x-scanner` | `@lab3-ai/plugin-x-scanner` |
| `@paperclipai/plugin-polymarket-scanner` | `@lab3-ai/plugin-polymarket-scanner` |
| `@paperclipai/plugin-telegram-notifier` | `@lab3-ai/plugin-telegram-notifier` |

### Manifest ID Renames

| Current | New |
|---------|-----|
| `paperclipai.plugin-x-scanner` | `lab3-ai.plugin-x-scanner` |
| `paperclipai.plugin-polymarket-scanner` | `lab3-ai.plugin-polymarket-scanner` |
| `paperclipai.plugin-telegram-notifier` | `lab3-ai.plugin-telegram-notifier` |

### package.json Changes (each plugin)

```json
{
  "name": "@lab3-ai/plugin-x-scanner",
  "private": false,
  "license": "MIT",
  "files": ["dist/"],
  ...
}
```

### Publish Flow

```bash
cd plugin-x-scanner && npm publish --access public
cd plugin-polymarket-scanner && npm publish --access public
cd plugin-telegram-notifier && npm publish --access public
```

### Install by Friends

```bash
paperclipai plugin install @lab3-ai/plugin-x-scanner
paperclipai plugin install @lab3-ai/plugin-polymarket-scanner
paperclipai plugin install @lab3-ai/plugin-telegram-notifier
```

### Event Name Update

Telegram Notifier subscribes to event from Polymarket Scanner. Event name must match new manifest ID:

- Old: `plugin.paperclipai.plugin-polymarket-scanner.new_markets`
- New: `plugin.lab3-ai.plugin-polymarket-scanner.new_markets`

---

## Feature 2: Available Plugins List

### Changes

**File**: `server/src/routes/plugins.ts`

Add 3 entries to `BUNDLED_PLUGIN_EXAMPLES` array:

```typescript
{
  packageName: "@lab3-ai/plugin-x-scanner",
  pluginKey: "lab3-ai.plugin-x-scanner",
  displayName: "X Post Scanner",
  description: "Scans X (Twitter) posts from configured members via RapidAPI and saves to Supabase",
  tag: "lab3",
},
{
  packageName: "@lab3-ai/plugin-polymarket-scanner",
  pluginKey: "lab3-ai.plugin-polymarket-scanner",
  displayName: "Polymarket Scanner",
  description: "Scans Polymarket via Gamma API, uses AI to analyze relevance, and triggers notifications",
  tag: "lab3",
},
{
  packageName: "@lab3-ai/plugin-telegram-notifier",
  pluginKey: "lab3-ai.plugin-telegram-notifier",
  displayName: "Telegram Notifier",
  description: "Sends Polymarket alerts to a Telegram group via bot",
  tag: "lab3",
},
```

No `localPath` — installs from npm registry. UI shows "Install" button (not "Install Example").

---

## Feature 3: Config Form via `instanceConfigSchema`

### X Scanner

```typescript
instanceConfigSchema: {
  type: "object",
  required: ["rapidApiKey", "supabaseUrl", "supabaseServiceKey", "companyId", "members"],
  properties: {
    rapidApiKey: { type: "string", title: "RapidAPI Key", format: "secret-ref" },
    supabaseUrl: { type: "string", title: "Supabase URL" },
    supabaseServiceKey: { type: "string", title: "Supabase Service Key", format: "secret-ref" },
    companyId: { type: "string", title: "Company ID" },
    members: { type: "array", title: "Twitter Handles", items: { type: "string" } },
    scanIntervalMinutes: { type: "number", title: "Scan Interval (minutes)", default: 15 },
    maxPostsPerMember: { type: "number", title: "Max Posts per Member", default: 20 },
  },
},
```

### Polymarket Scanner

```typescript
instanceConfigSchema: {
  type: "object",
  required: ["supabaseUrl", "supabaseServiceKey", "companyId", "keywords", "agentSlug"],
  properties: {
    supabaseUrl: { type: "string", title: "Supabase URL" },
    supabaseServiceKey: { type: "string", title: "Supabase Service Key", format: "secret-ref" },
    companyId: { type: "string", title: "Company ID" },
    keywords: { type: "array", title: "Keywords", items: { type: "string" } },
    agentSlug: { type: "string", title: "Agent Slug (for AI analysis)" },
    minVolume: { type: "number", title: "Min Volume", default: 1000 },
    minAiRelevanceScore: { type: "number", title: "Min AI Score", default: 0.6 },
    scanIntervalMinutes: { type: "number", title: "Scan Interval (minutes)", default: 60 },
  },
},
```

### Telegram Notifier

```typescript
instanceConfigSchema: {
  type: "object",
  required: ["botToken", "chatId", "supabaseUrl", "supabaseServiceKey"],
  properties: {
    botToken: { type: "string", title: "Telegram Bot Token", format: "secret-ref" },
    chatId: { type: "string", title: "Telegram Chat ID" },
    supabaseUrl: { type: "string", title: "Supabase URL" },
    supabaseServiceKey: { type: "string", title: "Supabase Service Key", format: "secret-ref" },
  },
},
```

### UI Rendering

Plugin Settings page shows both:
1. **Auto-generated config form** from `instanceConfigSchema` — renders input fields, validates, saves via API
2. **Custom settings page** (existing component) — status display, test actions

The Paperclip `PluginSettings.tsx` already handles this: if both `instanceConfigSchema` and custom `settingsPage` slot exist, it renders the auto-form first, then mounts the custom component below it.
