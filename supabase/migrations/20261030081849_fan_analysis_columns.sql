-- 20261030081849_fan_analysis_columns.sql
-- Fills in the fan_analysis table (006 created it with no columns). One row per
-- analysis run, written by scripts/fanAnalysis/06_summarise.js and read by the
-- /fan-analysis page.
--
-- Rows hold aggregated results only: shares of fans per category/interest/team,
-- engagement totals, and named public accounts. No fan usernames or IDs.

alter table fan_analysis
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists artist text not null default 'circawaves',
  add column if not exists platform text not null default 'instagram',
  -- The run's file stamp, e.g. "2026-10-30T08-20-00-000Z", so re-running 06 on
  -- the same data updates its row instead of adding a duplicate
  add column if not exists source_stamp text not null,
  add column if not exists fans_analysed integer,
  add column if not exists accounts_categorised integer,
  -- { postCount, firstPostDate, lastPostDate, totalFans, privateFans, ... }
  add column if not exists engagement jsonb,
  -- { categories, subcategories, teams, accounts, accountsByCategory }
  add column if not exists summary jsonb not null,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists idx_fan_analysis_artist_stamp
  on fan_analysis (artist, platform, source_stamp);

create index if not exists idx_fan_analysis_created_at
  on fan_analysis (artist, created_at desc);

-- Only the server (service role key) reads and writes this table. With RLS on
-- and no policies, the public anon key can't read it.
alter table fan_analysis enable row level security;
