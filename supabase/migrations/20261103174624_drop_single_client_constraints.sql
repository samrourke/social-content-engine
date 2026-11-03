--20261103174624_drop_single_client_constraints.sql

--dropping old single client constraints that no longer apply
--per client constraints have been added in 20261103130602_add_client_unique_constraints.sql


alter table content_discoveries
  add constraint content_discoveries_client_id_normalised_source_url_key
    unique (client_id, normalised_source_url),
  drop constraint content_discoveries_platform_platform_video_id_key,
  drop constraint content_discoveries_source_url_key;

drop index content_discoveries_normalised_source_url_key;

create unique index circa_full_content_client_id_normalised_source_url_key
  on circa_full_content (client_id, normalised_source_url)
  where normalised_source_url is not null;

drop index circa_full_content_normalised_source_url_key;