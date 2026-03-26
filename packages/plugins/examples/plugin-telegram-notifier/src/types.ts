export interface TelegramConfig {
  botToken: string;
  chatId: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
}

export interface MarketAlert {
  market_id: string;
  question: string;
  outcome_prices: Record<string, number>;
  ai_relevance_score: number;
  ai_analysis: string;
  url: string;
}

export interface MarketEventPayload {
  markets: MarketAlert[];
}
