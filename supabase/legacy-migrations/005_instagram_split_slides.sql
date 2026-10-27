-- 005_instagram_split_slides.sql
-- Splits Instagram carousels into one review row per video slide, so each clip
-- can be watched and approved on its own.
--
-- A split carousel keeps its own row (review_status = 'split') so repeat scrapes
-- still recognise it. Each video slide gets a row with:
--   platform_video_id  "<shortCode>-slide<N>"
--   parent_short_code  the carousel's shortCode
--   slide_number       1-based position, the same numbering as carousel_slides
--   video_url          the slide's video on Instagram's CDN. These links expire a
--                      few days after the scrape; renew them with
--                      `node scripts/instagramSearch.js --refresh`.
--
-- Approving a slide row sets carousel_slides = [slide_number], so importing and
-- downloading work exactly as for a carousel reviewed as a whole.

alter table instagram_discoveries
  add column if not exists parent_short_code text,
  add column if not exists slide_number integer,
  add column if not exists video_url text;

-- What moved discovery_score, e.g. {"+20 named in first line","-25 30 hashtags"},
-- shown in the reviewer so the ranking can be tuned.
alter table instagram_discoveries
  add column if not exists score_reasons text[];

create index if not exists idx_instagram_discoveries_parent_short_code
  on instagram_discoveries (parent_short_code);
