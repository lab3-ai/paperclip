import { describe, it, expect, vi } from "vitest";
import { upsertMarkets, updateNotifiedAt } from "../src/supabase.js";
import type { AnalyzedMarket } from "../src/types.js";

describe("upsertMarkets", () => {
  it("calls supabase upsert with correct data", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
    const mockClient = { from: mockFrom } as any;
    const markets: AnalyzedMarket[] = [
      {
        market_id: "m1",
        question: "Will BTC hit 100k?",
        description: "About Bitcoin",
        category: "crypto",
        outcome_prices: { Yes: 0.65, No: 0.35 },
        volume: 1500000,
        liquidity: 250000,
        end_date: "2026-12-31",
        status: "active",
        url: "https://polymarket.com/event/btc",
        raw_data: {},
        matched_keywords: ["crypto"],
        ai_relevance_score: 0.9,
        ai_analysis: "Highly relevant",
      },
    ];
    const result = await upsertMarkets(mockClient, markets);
    expect(mockFrom).toHaveBeenCalledWith("polymarket_markets");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          market_id: "m1",
          question: "Will BTC hit 100k?",
        }),
      ]),
      { onConflict: "market_id" },
    );
    expect(result.error).toBeNull();
  });

  it("returns null error on empty array", async () => {
    const mockClient = { from: vi.fn() } as any;
    const result = await upsertMarkets(mockClient, []);
    expect(result.error).toBeNull();
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it("returns error message on supabase failure", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Connection failed" },
    });
    const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
    const mockClient = { from: mockFrom } as any;
    const markets: AnalyzedMarket[] = [
      {
        market_id: "m2",
        question: "Q",
        description: null,
        category: null,
        outcome_prices: {},
        volume: 0,
        liquidity: 0,
        end_date: null,
        status: "active",
        url: null,
        raw_data: {},
        matched_keywords: [],
        ai_relevance_score: null,
        ai_analysis: null,
      },
    ];
    const result = await upsertMarkets(mockClient, markets);
    expect(result.error).toBe("Connection failed");
  });
});

describe("updateNotifiedAt", () => {
  it("calls supabase update with market ids", async () => {
    const mockIn = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn });
    const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
    const mockClient = { from: mockFrom } as any;

    await updateNotifiedAt(mockClient, ["m1", "m2"]);
    expect(mockFrom).toHaveBeenCalledWith("polymarket_markets");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ notified_at: expect.any(String) }),
    );
    expect(mockIn).toHaveBeenCalledWith("market_id", ["m1", "m2"]);
  });

  it("does nothing for empty array", async () => {
    const mockClient = { from: vi.fn() } as any;
    await updateNotifiedAt(mockClient, []);
    expect(mockClient.from).not.toHaveBeenCalled();
  });
});
