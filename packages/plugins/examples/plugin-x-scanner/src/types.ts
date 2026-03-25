export interface XScannerConfig {
  rapidApiKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  members: string[];
  scanIntervalMinutes: number;
  maxPostsPerMember: number;
  companyId: string;
}

export interface XPost {
  post_id: string;
  author_handle: string;
  author_name: string | null;
  content: string;
  posted_at: string;
  likes_count: number;
  retweets_count: number;
  replies_count: number;
  url: string | null;
  media_urls: string[];
  raw_data: unknown;
}

