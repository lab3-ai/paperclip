# Telegram Notifier Plugin

Paperclip plugin that sends Polymarket alerts to a Telegram group when the Polymarket Scanner finds relevant markets.

## Prerequisites

- Paperclip instance running
- Telegram bot created via BotFather (with bot token)
- Bot added to the target Telegram group
- Polymarket Scanner plugin installed and configured
- Supabase project (same as Polymarket Scanner)

## Installation

```bash
paperclipai plugin install @lab3-ai/plugin-telegram-notifier
```

## Configuration

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `botToken` | secret | Yes | Telegram bot token from BotFather |
| `chatId` | string | Yes | Telegram group chat ID |
| `supabaseUrl` | string | Yes | Supabase project URL |
| `supabaseServiceKey` | secret | Yes | Supabase service role key |

## How It Works

- Subscribes to `plugin.paperclipai.plugin-polymarket-scanner.new_markets` event
- When triggered, formats each market as a text message
- Sends messages to the configured Telegram group via Bot API
- Rate limits at 1 message per 3 seconds (Telegram group limit)
- Updates `notified_at` in Supabase after sending
- Retries failed sends up to 3 times with exponential backoff

## Message Format

```
New Polymarket Alert

Q: Will Bitcoin reach $100k by July 2026?
Yes: 72% | No: 28%
AI Score: 0.85

https://polymarket.com/event/btc-100k
```

## Testing

Use the "Send Test Message" button in the plugin settings page to verify your bot token and chat ID are configured correctly.
