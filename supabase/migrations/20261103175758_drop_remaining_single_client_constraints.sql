--removing constraints that where left out of
--previous migrations, to allow for multi tenancy set up; 


alter table tiktok_videos
  drop constraint tiktok_videos_platform_video_id_key;

alter table instagram_discoveries
  drop constraint instagram_discoveries_platform_video_id_key;

alter table discovery_search_state
  drop constraint discovery_search_state_pkey,
  add primary key (client_id, query);

alter table discovery_search_state
  drop constraint discovery_search_state_client_id_query_key;