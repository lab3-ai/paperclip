import type { Market, GammaMarket } from "./types.js";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
const GAMMA_API_BASE = "https://gamma-api.polymarket.com";

export function mapGammaMarket(g: GammaMarket): Market {
  // Gamma API returns outcomes/outcomePrices as JSON strings or arrays
  const outcomes: string[] =
    typeof g.outcomes === "string" ? JSON.parse(g.outcomes) : g.outcomes ?? [];
  const outcomePrices: string[] =
    typeof g.outcomePrices === "string" ? JSON.parse(g.outcomePrices) : g.outcomePrices ?? [];

  const prices: Record<string, number> = {};
  outcomes.forEach((outcome, i) => {
    prices[outcome] = parseFloat(outcomePrices[i] ?? "0");
  });
  return {
    market_id: String(g.id),
    question: g.question,
    description: g.description || null,
    category: g.category || null,
    outcome_prices: prices,
    volume: typeof g.volume === "number" ? g.volume : parseFloat(g.volume) || 0,
    liquidity: typeof g.liquidity === "number" ? g.liquidity : parseFloat(g.liquidity) || 0,
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
  keywords: string[],
): Promise<Market[]> {
  const allMarkets: Market[] = [];
  for (const keyword of keywords) {
    const url = `${GAMMA_API_BASE}/markets?tag=${encodeURIComponent(keyword)}&active=true&closed=false&limit=100`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) continue;
    const data = (await response.json()) as GammaMarket[];
    allMarkets.push(...data.map(mapGammaMarket));
  }
  return dedup(allMarkets);
}
