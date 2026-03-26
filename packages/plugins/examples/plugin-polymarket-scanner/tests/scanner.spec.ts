import { describe, it, expect, vi } from "vitest";
import {
  mapGammaMarket,
  filterByVolume,
  dedup,
  fetchMarkets,
} from "../src/scanner.js";
import type { GammaMarket, Market } from "../src/types.js";

describe("mapGammaMarket", () => {
  it("maps a Gamma market to Market format", () => {
    const gamma: GammaMarket = {
      id: "abc-123",
      question: "Will BTC hit 100k?",
      description: "Market about Bitcoin price",
      category: "crypto",
      outcomes: ["Yes", "No"],
      outcomePrices: ["0.65", "0.35"],
      volume: "1500000",
      liquidity: "250000",
      endDate: "2026-12-31T00:00:00Z",
      active: true,
      closed: false,
      slug: "will-btc-hit-100k",
    };
    const market = mapGammaMarket(gamma);
    expect(market.market_id).toBe("abc-123");
    expect(market.question).toBe("Will BTC hit 100k?");
    expect(market.description).toBe("Market about Bitcoin price");
    expect(market.category).toBe("crypto");
    expect(market.outcome_prices).toEqual({ Yes: 0.65, No: 0.35 });
    expect(market.volume).toBe(1500000);
    expect(market.liquidity).toBe(250000);
    expect(market.end_date).toBe("2026-12-31T00:00:00Z");
    expect(market.status).toBe("active");
    expect(market.url).toBe(
      "https://polymarket.com/event/will-btc-hit-100k",
    );
    expect(market.raw_data).toBe(gamma);
  });

  it("handles closed market status", () => {
    const gamma: GammaMarket = {
      id: "x",
      question: "Q",
      description: "",
      category: "",
      outcomes: [],
      outcomePrices: [],
      volume: "0",
      liquidity: "0",
      endDate: "",
      active: false,
      closed: true,
      slug: "",
    };
    const market = mapGammaMarket(gamma);
    expect(market.status).toBe("closed");
    expect(market.url).toBeNull();
    expect(market.description).toBeNull();
  });

  it("handles inactive market status", () => {
    const gamma: GammaMarket = {
      id: "y",
      question: "Q2",
      description: "",
      category: "",
      outcomes: [],
      outcomePrices: [],
      volume: "0",
      liquidity: "0",
      endDate: "",
      active: false,
      closed: false,
      slug: "some-slug",
    };
    const market = mapGammaMarket(gamma);
    expect(market.status).toBe("inactive");
  });
});

describe("filterByVolume", () => {
  it("filters markets below the minimum volume", () => {
    const markets: Market[] = [
      { market_id: "1", volume: 100 } as Market,
      { market_id: "2", volume: 500 } as Market,
      { market_id: "3", volume: 1000 } as Market,
    ];
    const result = filterByVolume(markets, 500);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.market_id)).toEqual(["2", "3"]);
  });

  it("returns all markets when minVolume is 0", () => {
    const markets: Market[] = [
      { market_id: "1", volume: 0 } as Market,
      { market_id: "2", volume: 100 } as Market,
    ];
    const result = filterByVolume(markets, 0);
    expect(result).toHaveLength(2);
  });
});

describe("dedup", () => {
  it("removes duplicate markets by market_id", () => {
    const markets: Market[] = [
      { market_id: "1", question: "First" } as Market,
      { market_id: "2", question: "Second" } as Market,
      { market_id: "1", question: "Duplicate" } as Market,
    ];
    const result = dedup(markets);
    expect(result).toHaveLength(2);
    expect(result[0].question).toBe("First");
    expect(result[1].question).toBe("Second");
  });

  it("returns empty array for empty input", () => {
    expect(dedup([])).toEqual([]);
  });
});

describe("fetchMarkets", () => {
  it("calls Gamma API for each keyword and merges results", async () => {
    const gammaMarket1: GammaMarket = {
      id: "m1",
      question: "Market 1",
      description: "Desc 1",
      category: "cat",
      outcomes: ["Yes", "No"],
      outcomePrices: ["0.7", "0.3"],
      volume: "5000",
      liquidity: "1000",
      endDate: "2026-12-31",
      active: true,
      closed: false,
      slug: "market-1",
    };
    const gammaMarket2: GammaMarket = {
      id: "m2",
      question: "Market 2",
      description: "Desc 2",
      category: "cat",
      outcomes: ["Yes", "No"],
      outcomePrices: ["0.5", "0.5"],
      volume: "3000",
      liquidity: "500",
      endDate: "2026-12-31",
      active: true,
      closed: false,
      slug: "market-2",
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [gammaMarket1],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [gammaMarket2],
      });

    const markets = await fetchMarkets(mockFetch, ["ai", "crypto"]);
    expect(markets).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("tag=ai"),
      expect.objectContaining({ method: "GET" }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("tag=crypto"),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("deduplicates markets across keywords", async () => {
    const gammaMarket: GammaMarket = {
      id: "same-id",
      question: "Q",
      description: "",
      category: "",
      outcomes: [],
      outcomePrices: [],
      volume: "0",
      liquidity: "0",
      endDate: "",
      active: true,
      closed: false,
      slug: "q",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [gammaMarket],
    });

    const markets = await fetchMarkets(mockFetch, ["a", "b"]);
    expect(markets).toHaveLength(1);
  });

  it("skips failed API responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    const markets = await fetchMarkets(mockFetch, ["test"]);
    expect(markets).toEqual([]);
  });
});
