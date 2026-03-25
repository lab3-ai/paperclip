export interface PolymarketConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  keywords: string[];
  minVolume: number;
  minAiRelevanceScore: number;
  scanIntervalMinutes: number;
  agentSlug: string;
  companyId: string;
}

export interface Market {
  market_id: string;
  question: string;
  description: string | null;
  category: string | null;
  outcome_prices: Record<string, number>;
  volume: number;
  liquidity: number;
  end_date: string | null;
  status: string;
  url: string | null;
  raw_data: unknown;
}

export interface AnalyzedMarket extends Market {
  matched_keywords: string[];
  ai_relevance_score: number | null;
  ai_analysis: string | null;
}

export interface GammaMarket {
  id: string | number;
  question: string;
  description: string;
  category: string;
  outcomes: string[] | string;
  outcomePrices: string[] | string;
  volume: string | number;
  liquidity: string | number;
  endDate: string;
  active: boolean;
  closed: boolean;
  slug: string;
}

export interface MarketEventPayload {
  markets: Array<{
    market_id: string;
    question: string;
    outcome_prices: Record<string, number>;
    ai_relevance_score: number;
    ai_analysis: string;
    url: string;
  }>;
}
