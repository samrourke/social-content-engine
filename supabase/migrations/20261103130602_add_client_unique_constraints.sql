--20261103130602_add_client_unique_constraints
-- adds unique constraints to supabase table columns to ensure 
-- client data is unique per client. 
--old constraints from the single client setup will be dropped at a later stage once scripts are updated.




alter table tiktok_videos
  add constraint tiktok_videos_client_id_platform_video_id_key
  unique (client_id, platform_video_id);


alter table instagram_discoveries
    add constraint instagram_discoveries_client_id_platform_video_id_key
    unique (client_id, platform_video_id);


alter table content_discoveries
  add constraint content_discoveries_client_id_platform_platform_video_id_key
    unique (client_id, platform, platform_video_id),
  add constraint content_discoveries_client_id_source_url_key
    unique (client_id, source_url);

alter table discovery_search_state
    add constraint discovery_search_state_client_id_query_key
    unique (client_id, query);

alter table fan_analysis
    add constraint fan_analysis_client_id_platform_source_stamp_key
    unique (client_id, platform, source_stamp);