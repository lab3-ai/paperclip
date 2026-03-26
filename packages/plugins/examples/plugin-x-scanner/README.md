# X Post Scanner Plugin

Paperclip plugin that scans X (Twitter) posts from configured members via RapidAPI and saves them to Supabase.

## Prerequisites

- Paperclip instance running
- Supabase project (free tier OK)
- RapidAPI account with a Twitter/X API endpoint subscription (e.g. twitter-api45)

## Installation

```bash
paperclipai plugin install @lab3-ai/plugin-x-scanner
```

Or install from local path (development):

```bash
curl -X POST http://127.0.0.1:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"/absolute/path/to/plugin-x-scanner","isLocalPath":true}'
```

## Supabase Setup

Run the SQL in `supabase-schema.sql` in your Supabase Dashboard > SQL Editor.

## Configuration

Set these values in the plugin configuration panel:

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `rapidApiKey` | secret | Yes | RapidAPI key (stored as secret reference) |
| `supabaseUrl` | string | Yes | Supabase project URL |
| `supabaseServiceKey` | secret | Yes | Supabase service role key |
| `companyId` | string | Yes | Paperclip company ID |
| `members` | string[] | Yes | Twitter handles to scan (without @) |
| `scanIntervalMinutes` | number | No | Scan interval in minutes (default: 15) |
| `maxPostsPerMember` | number | No | Max posts per member per scan (default: 20) |

## How It Works

- Runs a cron job every 15 minutes (configurable)
- For each configured member, fetches recent posts via RapidAPI
- Filters posts newer than the last scan timestamp
- Upserts new posts to Supabase `x_posts` table (dedup by post_id)
- Logs activity to Paperclip activity log
