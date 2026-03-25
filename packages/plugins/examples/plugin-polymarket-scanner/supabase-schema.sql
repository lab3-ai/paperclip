-- Polymarket Scanner: Supabase schema
-- Run this in Supabase Dashboard > SQL Editor

create table if not exists polymarket_markets (
  id uuid default gen_random_uuid() primary key,
  market_id text not null unique,
  question text not null,
  description text,
  category text,
  outcome_prices jsonb,
  volume numeric,
  liquidity numeric,
  end_date timestamptz,
  status text default 'active',
  matched_keywords text[],
  ai_relevance_score numeric,
  ai_analysis text,
  url text,
  raw_data jsonb,
  notified_at timestamptz,
  last_scanned_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pm_markets_status on polymarket_markets(status);
create index if not exists idx_pm_markets_relevance on polymarket_markets(ai_relevance_score desc);
create index if not exists idx_pm_markets_notified on polymarket_markets(notified_at);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_pm_markets_updated_at on polymarket_markets;
create trigger trg_pm_markets_updated_at
  before update on polymarket_markets
  for each row execute function update_updated_at();
