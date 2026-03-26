import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { XPost } from "./types.js";

export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key);
}

export async function upsertPosts(
  client: SupabaseClient, posts: XPost[]
): Promise<{ inserted: number; error: string | null }> {
  if (posts.length === 0) return { inserted: 0, error: null };
  const rows = posts.map((p) => ({
    post_id: p.post_id, author_handle: p.author_handle, author_name: p.author_name,
    content: p.content, posted_at: p.posted_at, likes_count: p.likes_count,
    retweets_count: p.retweets_count, replies_count: p.replies_count,
    url: p.url, media_urls: p.media_urls, raw_data: p.raw_data,
  }));
  const { error } = await client.from("x_posts").upsert(rows, { onConflict: "post_id", ignoreDuplicates: true });
  if (error) return { inserted: 0, error: error.message };
  return { inserted: rows.length, error: null };
}
