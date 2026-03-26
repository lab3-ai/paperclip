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
  maxRetries: number = 3,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    if (response.ok) return;
    if (attempt === maxRetries) {
      throw new Error(
        `Telegram API failed after ${maxRetries} attempts: ${response.status} ${response.statusText}`,
      );
    }
    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
  }
}
