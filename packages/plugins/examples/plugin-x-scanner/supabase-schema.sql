-- X Scanner: Supabase schema
-- Run this in Supabase Dashboard > SQL Editor

create table if not exists x_posts (
  id uuid default gen_random_uuid() primary key,
  post_id text not null unique,
  author_handle text not null,
  author_name text,
  content text not null,
  posted_at timestamptz not null,
  likes_count int default 0,
  retweets_count int default 0,
  replies_count int default 0,
  url text,
  media_urls jsonb default '[]',
  raw_data jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_x_posts_author on x_posts(author_handle);
create index if not exists idx_x_posts_posted_at on x_posts(posted_at desc);
