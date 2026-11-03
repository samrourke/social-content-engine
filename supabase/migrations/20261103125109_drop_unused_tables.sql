-- 20261103125109_drop_unused_tables.sql
-- Drops two tables no code uses, left over from the July 2026 Vizard and
-- download tests. Data saved as CSV in backups/2026-11-03/.


drop table if exists yt_content;


drop table if exists content_sources;