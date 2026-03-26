import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AnalyzedMarket } from "./types.js";

export function createSupabaseClient(
  url: string,
  key: string,
): SupabaseClient {
  return createClient(url, key);
}

export async function upsertMarkets(
  client: SupabaseClient,
  markets: AnalyzedMarket[],
): Promise<{ error: string | null }> {
  if (markets.length === 0) return { error: null };
  const rows = markets.map((m) => ({
    market_id: m.market_id,
    question: m.question,
    description: m.description,
    category: m.category,
    outcome_prices: m.outcome_prices,
    volume: m.volume,
    liquidity: m.liquidity,
    end_date: m.end_date,
    status: m.status,
    matched_keywords: m.matched_keywords,
    ai_relevance_score: m.ai_relevance_score,
    ai_analysis: m.ai_analysis,
    url: m.url,
    raw_data: m.raw_data,
    last_scanned_at: new Date().toISOString(),
  }));
  const { error } = await client
    .from("polymarket_markets")
    .upsert(rows, { onConflict: "market_id" });
  return { error: error?.message ?? null };
}

export async function updateNotifiedAt(
  client: SupabaseClient,
  marketIds: string[],
): Promise<void> {
  if (marketIds.length === 0) return;
  await client
    .from("polymarket_markets")
    .update({ notified_at: new Date().toISOString() })
    .in("market_id", marketIds);
}
