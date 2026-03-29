/** Operator-provided instance configuration */
export interface CoingeckoConfig {
  companyId: string;
  scanMode: "top" | "trending" | "watchlist" | "all";
  watchlistCoinIds: string;
  topCoinsLimit: number;
  priceChangeThreshold: number;
  volumeChangeThreshold: number;
  currency: string;
}

/** Single coin data from CoinGecko or normalized */
export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  priceChange24hPercent: number;
  volume24h: number;
  marketCap: number;
  source: "top" | "trending" | "watchlist";
}

/** Stored scan result in plugin state */
export interface ScanResult {
  scannedAt: string;
  scanMode: string;
  coins: CoinData[];
  alertsTriggered: number;
}

/** Coin with diff compared to previous scan */
export interface CoinDiff {
  coin: CoinData;
  prevPrice: number | null;
  volumeChangePercent: number | null;
}

/** Event payload: scan complete */
export interface ScanCompletePayload {
  scannedAt: string;
  coinCount: number;
  coins: CoinData[];
}

/** Event payload: price alert */
export interface PriceAlertPayload {
  coin: CoinData;
  priceChangePercent: number;
  volumeChangePercent: number | null;
  reason: string;
}

/** CoinGecko /coins/markets response item */
export interface CoinGeckoMarketItem {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  total_volume: number;
  market_cap: number;
}

/** CoinGecko /search/trending response */
export interface CoinGeckoTrendingResponse {
  coins: Array<{
    item: {
      id: string;
      symbol: string;
      name: string;
      data?: {
        price?: number;
        price_change_percentage_24h?: Record<string, number>;
        total_volume?: string;
        market_cap?: string;
      };
    };
  }>;
}

/** CoinGecko /simple/price response */
export type CoinGeckoSimplePriceResponse = Record<
  string,
  Record<string, number | undefined>
>;
