import { describe, it, expect, vi } from "vitest";
import { upsertPosts } from "../src/supabase.js";
import type { XPost } from "../src/types.js";

describe("upsertPosts", () => {
  it("calls supabase upsert with correct data", async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
    const mockClient = { from: mockFrom } as any;
    const posts: XPost[] = [{
      post_id: "123", author_handle: "alice", author_name: "Alice",
      content: "Hello", posted_at: "2026-03-24T10:00:00Z",
      likes_count: 5, retweets_count: 1, replies_count: 0,
      url: "https://x.com/alice/123", media_urls: [], raw_data: {},
    }];
    const result = await upsertPosts(mockClient, posts);
    expect(mockFrom).toHaveBeenCalledWith("x_posts");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ post_id: "123", author_handle: "alice" })]),
      { onConflict: "post_id", ignoreDuplicates: true }
    );
    expect(result.inserted).toBe(1);
  });

  it("returns 0 inserted on empty array", async () => {
    const mockClient = { from: vi.fn() } as any;
    const result = await upsertPosts(mockClient, []);
    expect(result.inserted).toBe(0);
  });
});
