import { describe, it, expect, vi } from "vitest";
import { formatMarketMessage, sendTelegramMessage } from "../src/notifier.js";
import type { MarketAlert } from "../src/types.js";

describe("formatMarketMessage", () => {
  it("formats a market alert into a readable message", () => {
    const market: MarketAlert = {
      market_id: "mkt-1",
      question: "Will BTC hit $100k by end of 2026?",
      outcome_prices: { Yes: 0.65, No: 0.35 },
      ai_relevance_score: 0.92,
      ai_analysis: "High relevance due to market momentum",
      url: "https://polymarket.com/event/btc-100k",
    };

    const message = formatMarketMessage(market);
    expect(message).toContain("New Polymarket Alert");
    expect(message).toContain("Q: Will BTC hit $100k by end of 2026?");
    expect(message).toContain("Yes: 65%");
    expect(message).toContain("No: 35%");
    expect(message).toContain("AI Score: 0.92");
    expect(message).toContain("https://polymarket.com/event/btc-100k");
  });

  it("handles single outcome price", () => {
    const market: MarketAlert = {
      market_id: "mkt-2",
      question: "Simple question?",
      outcome_prices: { Yes: 0.5 },
      ai_relevance_score: 0.5,
      ai_analysis: "Moderate",
      url: "https://polymarket.com/event/simple",
    };
    const message = formatMarketMessage(market);
    expect(message).toContain("Yes: 50%");
  });
});

describe("sendTelegramMessage", () => {
  it("sends a message successfully on first attempt", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    await sendTelegramMessage(mockFetch, "bot-token-123", "chat-456", "Hello!");

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botbot-token-123/sendMessage",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: "chat-456",
          text: "Hello!",
          parse_mode: "Markdown",
        }),
      }),
    );
  });

  it("retries on failure and succeeds", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" })
      .mockResolvedValueOnce({ ok: true });

    await sendTelegramMessage(mockFetch, "token", "chat", "Retry test", 3);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });

    await expect(
      sendTelegramMessage(mockFetch, "token", "chat", "Fail test", 2),
    ).rejects.toThrow("Telegram API failed after 2 attempts: 429 Too Many Requests");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
