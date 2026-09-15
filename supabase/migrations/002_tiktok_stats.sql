-- 002_tiktok_stats.sql
-- Adds tables to track Circa Waves' TikTok profile growth and per-video performance,
-- fed by scripts/syncTikTokStats.js (Apify).

create table if not exists tiktok_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  scraped_at timestamptz not null default now(),
  follower_count integer,
  following_count integer,
  likes_total bigint,
  video_count integer
);

create index if not exists idx_tiktok_profile_snapshots_scraped_at
  on tiktok_profile_snapshots (scraped_at);

create table if not exists tiktok_videos (
  id uuid primary key default gen_random_uuid(),
  platform_video_id text not null unique,
  post_date timestamptz,
  caption text,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  duration_seconds integer,
  content_pillar text,       -- nullable: filled in later via dashboard tagging / keyword match
  video_url text,
  first_scraped_at timestamptz not null default now(),
  last_scraped_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tiktok_videos_post_date
  on tiktok_videos (post_date);

create index if not exists idx_tiktok_videos_content_pillar
  on tiktok_videos (content_pillar);
