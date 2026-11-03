--20261103174002_require_client_id.sql
--drop default and set not null on client_id, so that it is required for all future inserts
--across all tables
--Entering Stage 3 of Phase 1 of the multi tenancy set up
--From now on client_id is set on all inserts, any insert without it will fail and will no longer default to circa waves

alter table tiktok_videos
  alter column client_id drop default,
  alter column client_id set not null;

alter table tiktok_profile_snapshots
  alter column client_id drop default,
  alter column client_id set not null;

alter table instagram_discoveries
  alter column client_id drop default,
  alter column client_id set not null;

alter table fan_analysis
  alter column client_id drop default,
  alter column client_id set not null;

alter table discovery_search_state
  alter column client_id drop default,
  alter column client_id set not null;

alter table content_discoveries
  alter column client_id drop default,
  alter column client_id set not null;

alter table circa_full_content
  alter column client_id drop default,
  alter column client_id set not null;


drop function default_client_id();