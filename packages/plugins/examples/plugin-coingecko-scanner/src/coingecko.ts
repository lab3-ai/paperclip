import type {
  CoinData,
  CoinGeckoMarketItem,
  CoinGeckoTrendingResponse,
  CoinGeckoSimplePriceResponse,
} from "./types.js";

const BASE_URL = "https://api.coingecko.com/api/v3";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Fetch top coins by market cap.
 */
export async function fetchTopCoins(
  fetchFn: FetchFn,
  currency: string,
  limit: number,
): Promise<CoinData[]> {
  const url = `${BASE_URL}/coins/markets?vs_currency=${currency}&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`;
  const resp = await fetchFn(url);
  if (!resp.ok) {
    throw new Error(`CoinGecko /coins/markets failed: ${resp.status}`);
  }
  const items: CoinGeckoMarketItem[] = await resp.json();
  return items.map((item) => ({
    id: item.id,
    symbol: item.symbol,
    name: item.name,
    currentPrice: item.current_price ?? 0,
    priceChange24hPercent: item.price_change_percentage_24h ?? 0,
    volume24h: item.total_volume ?? 0,
    marketCap: item.market_cap ?? 0,
    source: "top" as const,
  }));
}

/**
 * Fetch trending coins.
 */
export async function fetchTrendingCoins(
  fetchFn: FetchFn,
): Promise<CoinData[]> {
  const url = `${BASE_URL}/search/trending`;
  const resp = await fetchFn(url);
  if (!resp.ok) {
    throw new Error(`CoinGecko /search/trending failed: ${resp.status}`);
  }
  const data: CoinGeckoTrendingResponse = await resp.json();
  return data.coins.map((entry) => ({
    id: entry.item.id,
    symbol: entry.item.symbol,
    name: entry.item.name,
    currentPrice: entry.item.data?.price ?? 0,
    priceChange24hPercent:
      entry.item.data?.price_change_percentage_24h?.usd ?? 0,
    volume24h: parseFloat(entry.item.data?.total_volume ?? "0"),
    marketCap: parseFloat(entry.item.data?.market_cap ?? "0"),
    source: "trending" as const,
  }));
}

/**
 * Fetch specific coins by IDs (watchlist).
 */
export async function fetchWatchlistCoins(
  fetchFn: FetchFn,
  coinIds: string[],
  currency: string,
): Promise<CoinData[]> {
  if (coinIds.length === 0) return [];
  const ids = coinIds.join(",");
  const url = `${BASE_URL}/simple/price?ids=${ids}&vs_currencies=${currency}&include_24hr_change=true&include_24hr_vol=true`;
  const resp = await fetchFn(url);
  if (!resp.ok) {
    throw new Error(`CoinGecko /simple/price failed: ${resp.status}`);
  }
  const data: CoinGeckoSimplePriceResponse = await resp.json();
  return Object.entries(data).map(([id, values]) => ({
    id,
    symbol: id,
    name: id,
    currentPrice: values?.[currency] ?? 0,
    priceChange24hPercent: values?.[`${currency}_24h_change`] ?? values?.["usd_24h_change"] ?? 0,
    volume24h: values?.[`${currency}_24h_vol`] ?? values?.["usd_24h_vol"] ?? 0,
    marketCap: 0,
    source: "watchlist" as const,
  }));
}
