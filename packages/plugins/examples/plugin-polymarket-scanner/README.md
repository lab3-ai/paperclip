# Polymarket Scanner Plugin

Paperclip plugin that scans Polymarket markets via the Gamma API, uses AI to analyze relevance, saves results to Supabase, and emits events for downstream notifications.

## Prerequisites

- Paperclip instance running
- Supabase project (free tier OK)
- A Paperclip agent with Claude adapter (for AI analysis)

## Installation

```bash
paperclipai plugin install @lab3-ai/plugin-polymarket-scanner
```

## Supabase Setup

Run the SQL in `supabase-schema.sql` in your Supabase Dashboard > SQL Editor.

## Configuration

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `supabaseUrl` | string | Yes | Supabase project URL |
| `supabaseServiceKey` | secret | Yes | Supabase service role key |
| `companyId` | string | Yes | Paperclip company ID |
| `keywords` | string[] | Yes | Keywords to search (e.g. ["Bitcoin", "AI"]) |
| `agentSlug` | string | Yes | Paperclip agent slug for AI analysis |
| `minVolume` | number | No | Minimum trading volume (default: 1000) |
| `minAiRelevanceScore` | number | No | Minimum AI score to trigger notification (default: 0.6) |
| `scanIntervalMinutes` | number | No | Scan interval in minutes (default: 60) |

## How It Works

1. **Keyword Filter**: Fetches markets from Gamma API matching configured keywords
2. **Volume Filter**: Filters markets below minimum volume
3. **AI Analysis**: Sends markets to a Paperclip agent for relevance scoring (0-1)
4. **Save**: Upserts all discovered markets to Supabase `polymarket_markets` table
5. **Notify**: Emits `new_markets` event for relevant markets not previously notified

## Events

Emits: `plugin.paperclipai.plugin-polymarket-scanner.new_markets`

Install the Telegram Notifier plugin to receive notifications from this event.
