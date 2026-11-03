-- 20261103122412_add_client_id.sql
-- Adds client_id to the 7 kept tables so each row belongs to a client.
-- Existing rows (and new rows from the current scripts) default to Circa Waves.
-- TEMPORARY: the default and default_client_id() are removed in stage 3,
-- once the scripts set client_id themselves.


create or replace function default_client_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select id from clients where slug = 'circawaves'
$$;


--tiktok_videos
alter table tiktok_videos
  add column client_id uuid references clients(id) default default_client_id();

  create index if not exists idx_tiktok_videos_client_id
  on tiktok_videos (client_id);

--tiktok_profile_snapshots
  alter table tiktok_profile_snapshots
  add column client_id uuid references clients(id) default default_client_id();

  create index if not exists idx_tiktok_profile_snapshots_client_id
  on tiktok_profile_snapshots (client_id);

  --instagram_discoveries
    alter table instagram_discoveries
  add column client_id uuid references clients(id) default default_client_id();

  create index if not exists idx_instagram_discoveries_client_id
  on instagram_discoveries (client_id);

  --fan_analysis
      alter table fan_analysis
  add column client_id uuid references clients(id) default default_client_id();

  create index if not exists idx_fan_analysis_client_id
  on fan_analysis (client_id);

  --discovery_search_state
      alter table discovery_search_state
  add column client_id uuid references clients(id) default default_client_id();

  create index if not exists idx_discovery_search_state_client_id
  on discovery_search_state (client_id);

  --content_discoveries
      alter table content_discoveries
  add column client_id uuid references clients(id) default default_client_id();

  create index if not exists idx_content_discoveries_client_id
  on content_discoveries (client_id);

  --circa_full_content

        alter table circa_full_content
    add column client_id uuid REFERENCES clients(id) DEFAULT default_client_id(); 

 create index if not exists idx_circa_full_content_client_id
 on circa_full_content (client_id);



