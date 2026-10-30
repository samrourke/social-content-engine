-- 004_instagram_carousel_slides.sql
-- Lets the reviewer choose which slides of an Instagram carousel to keep, and
-- carries that choice through to downloadContent.js.
--
-- Slide numbers are 1-based positions in the carousel, matching what Instagram
-- shows and yt-dlp's --playlist-items.

-- Positions of the video slides according to the scraper. Only a hint: Apify can
-- miss slides at the end of long carousels. Null for non-carousel posts.
alter table instagram_discoveries
  add column if not exists carousel_video_slides integer[];

-- Slides chosen at review. Null means "every video in the post".
alter table instagram_discoveries
  add column if not exists carousel_slides integer[];

alter table circa_full_content
  add column if not exists carousel_slides integer[];
