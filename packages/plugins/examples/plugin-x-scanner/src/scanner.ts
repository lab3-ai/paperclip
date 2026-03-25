import type { XPost } from "./types.js";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const RAPIDAPI_HOST = "twttrapi.p.rapidapi.com";
const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}`;

interface TwttrApiTweet {
  rest_id: string;
  legacy: {
    full_text: string;
    created_at: string;
    favorite_count: number;
    retweet_count: number;
    reply_count: number;
    id_str: string;
    entities?: {
      media?: Array<{ media_url_https: string }>;
      urls?: Array<{ expanded_url: string }>;
    };
  };
  core?: {
    user_results?: {
      result?: {
        legacy?: {
          screen_name: string;
          name: string;
        };
      };
    };
  };
}

export function mapTwttrTweet(tweet: TwttrApiTweet, fallbackAuthor: string): XPost {
  const legacy = tweet.legacy;
  const authorLegacy = tweet.core?.user_results?.result?.legacy;
  const authorHandle = authorLegacy?.screen_name ?? fallbackAuthor;
  const authorName = authorLegacy?.name ?? null;
  const tweetId = tweet.rest_id || legacy.id_str;

  return {
    post_id: tweetId,
    author_handle: authorHandle,
    author_name: authorName,
    content: legacy.full_text,
    posted_at: new Date(legacy.created_at).toISOString(),
    likes_count: legacy.favorite_count ?? 0,
    retweets_count: legacy.retweet_count ?? 0,
    replies_count: legacy.reply_count ?? 0,
    url: `https://x.com/${authorHandle}/status/${tweetId}`,
    media_urls: legacy.entities?.media?.map((m) => m.media_url_https) ?? [],
    raw_data: tweet,
  };
}

export function extractTweetsFromResponse(data: unknown): TwttrApiTweet[] {
  const tweets: TwttrApiTweet[] = [];

  try {
    const root = data as any;
    const instructions =
      root?.data?.user_result?.result?.timeline_response?.timeline?.instructions ?? [];

    for (const instruction of instructions) {
      const entries = instruction?.entries ?? [];
      for (const entry of entries) {
        const tweetResult =
          entry?.content?.content?.tweetResult?.result ??
          entry?.content?.itemContent?.tweet_results?.result;

        if (tweetResult?.legacy?.full_text) {
          tweets.push(tweetResult);
        }
      }
    }
  } catch {
    // Silently handle parse errors
  }

  return tweets;
}

export async function scanMemberPosts(
  fetch: FetchFn,
  member: string,
  rapidApiKey: string,
  maxPosts: number,
): Promise<XPost[]> {
  const url = `${RAPIDAPI_BASE_URL}/user-tweets?username=${encodeURIComponent(member)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": rapidApiKey,
    },
  });
  if (!response.ok) return [];

  const data = await response.json();
  const tweets = extractTweetsFromResponse(data);

  return tweets.slice(0, maxPosts).map((t) => mapTwttrTweet(t, member));
}

export function filterNewPosts(posts: XPost[], lastScanAt: string | null): XPost[] {
  if (!lastScanAt) return posts;
  const cutoff = new Date(lastScanAt).getTime();
  return posts.filter((p) => new Date(p.posted_at).getTime() > cutoff);
}
