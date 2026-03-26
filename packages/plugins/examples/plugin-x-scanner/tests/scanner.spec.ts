import { describe, it, expect, vi } from "vitest";
import { scanMemberPosts, mapTweetToXPost, filterNewPosts } from "../src/scanner.js";

describe("mapTweetToXPost", () => {
  it("maps a RapidAPI tweet to XPost format", () => {
    const tweet = {
      id: "123456",
      text: "Hello world",
      created_at: "2026-03-24T10:00:00Z",
      author: { username: "testuser", name: "Test User" },
      likes: 42, retweets: 10, replies: 5,
      url: "https://x.com/testuser/status/123456",
      media: [{ url: "https://pbs.twimg.com/media/abc.jpg" }],
    };
    const post = mapTweetToXPost(tweet);
    expect(post.post_id).toBe("123456");
    expect(post.author_handle).toBe("testuser");
    expect(post.author_name).toBe("Test User");
    expect(post.content).toBe("Hello world");
    expect(post.posted_at).toBe("2026-03-24T10:00:00Z");
    expect(post.likes_count).toBe(42);
    expect(post.retweets_count).toBe(10);
    expect(post.replies_count).toBe(5);
    expect(post.url).toBe("https://x.com/testuser/status/123456");
    expect(post.media_urls).toEqual(["https://pbs.twimg.com/media/abc.jpg"]);
  });

  it("handles missing media", () => {
    const tweet = {
      id: "789", text: "No media", created_at: "2026-03-24T10:00:00Z",
      author: { username: "user2", name: "User Two" },
      likes: 0, retweets: 0, replies: 0,
    };
    const post = mapTweetToXPost(tweet);
    expect(post.media_urls).toEqual([]);
    expect(post.url).toBeNull();
  });
});

describe("filterNewPosts", () => {
  it("returns all posts when lastScanAt is null", () => {
    const posts = [
      { post_id: "1", posted_at: "2026-03-24T09:00:00Z" },
      { post_id: "2", posted_at: "2026-03-24T10:00:00Z" },
    ] as any[];
    const result = filterNewPosts(posts, null);
    expect(result).toHaveLength(2);
  });

  it("filters posts older than lastScanAt", () => {
    const posts = [
      { post_id: "1", posted_at: "2026-03-24T09:00:00Z" },
      { post_id: "2", posted_at: "2026-03-24T11:00:00Z" },
    ] as any[];
    const result = filterNewPosts(posts, "2026-03-24T10:00:00Z");
    expect(result).toHaveLength(1);
    expect(result[0].post_id).toBe("2");
  });
});

describe("scanMemberPosts", () => {
  it("calls RapidAPI and returns mapped posts", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{
          id: "111", text: "Post 1", created_at: "2026-03-24T09:00:00Z",
          author: { username: "alice", name: "Alice" },
          likes: 5, retweets: 1, replies: 0,
        }],
      }),
    });
    const posts = await scanMemberPosts(mockFetch, "alice", "test-rapid-api-key", 20);
    expect(posts).toHaveLength(1);
    expect(posts[0].author_handle).toBe("alice");
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("alice"),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-rapidapi-key": "test-rapid-api-key" }),
      })
    );
  });

  it("returns empty array on API error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429, statusText: "Too Many Requests" });
    const posts = await scanMemberPosts(mockFetch, "bob", "test-key", 20);
    expect(posts).toEqual([]);
  });
});
