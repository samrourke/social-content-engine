-- 003_instagram_discoveries.sql
-- Instagram equivalent of content_discoveries, fed by scripts/instagramSearch.js (Apify).
--
-- Every post the scraper returns is stored, including ones the relevance filter
-- rejects (review_status = 'auto_rejected'), so repeat scrapes are recognised
-- and never reach the review queue twice.
--
-- Search progress is kept in the existing discovery_search_state table under
-- keys prefixed with "instagram:" (e.g. "instagram:#circawaves").

create table if not exists instagram_discoveries (
  -- Same columns as content_discoveries
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'instagram',
  platform_video_id text not null unique,  -- Instagram shortCode
  title text not null,
  description text,
  source_url text not null,
  channel_name text,                       -- ownerUsername
  channel_id text,                         -- ownerId
  published_at timestamptz,
  thumbnail_url text,
  search_query text,
  discovery_score integer,
  suggested_content_type text,
  review_status text not null default 'pending', -- pending | approved | rejected | auto_rejected
  rejection_reason text,
  discovered_at timestamptz not null default now(),
  reviewed_at timestamptz,
  normalised_source_url text,
  archive_category text,
  imported_at timestamptz,

  -- Instagram-only: the signals the relevance filter uses
  music_artist text,
  music_song text,
  uses_original_audio boolean,
  play_count bigint,
  likes_count bigint,
  comments_count bigint,
  video_duration_seconds numeric
);

create index if not exists idx_instagram_discoveries_review_status
  on instagram_discoveries (review_status);

create index if not exists idx_instagram_discoveries_published_at
  on instagram_discoveries (published_at);

create index if not exists idx_instagram_discoveries_normalised_source_url
  on instagram_discoveries (normalised_source_url);
