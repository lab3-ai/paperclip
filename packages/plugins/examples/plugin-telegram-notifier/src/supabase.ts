import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key);
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
