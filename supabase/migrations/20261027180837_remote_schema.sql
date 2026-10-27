SET local check_function_bodies = off;

CREATE TABLE "public"."circa_full_content" (
  "title"                 text,
  "source_url"            text,
  "platform"              text,
  "raw_content_type"      text,
  "archive_category"      text,
  "content_type"          text,
  "source_date"           text,
  "source_location"       text,
  "description"           text,
  "processing_status"     text,
  "download_status"       text                     DEFAULT 'pending'::text,
  "downloaded_filename"   text,
  "downloaded_at"         timestamp with time zone,
  "download_error"        text,
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "updated_at"            timestamp with time zone,
  "normalised_source_url" text,
  "is_duplicate"          boolean                  DEFAULT false,
  "duplicate_of"          uuid,
  "carousel_slides"       integer[],
  CONSTRAINT "circa_full_content_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."circa_full_content"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."content_discoveries" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "platform"               text                     NOT NULL,
  "platform_video_id"      text,
  "title"                  text                     NOT NULL,
  "description"            text,
  "source_url"             text                     NOT NULL,
  "channel_name"           text,
  "channel_id"             text,
  "published_at"           timestamp with time zone,
  "thumbnail_url"          text,
  "search_query"           text,
  "discovery_score"        integer,
  "suggested_content_type" text,
  "review_status"          text                     NOT NULL DEFAULT 'pending'::text,
  "rejection_reason"       text,
  "discovered_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "reviewed_at"            timestamp with time zone,
  "normalised_source_url"  text,
  "archive_category"       text,
  "imported_at"            timestamp with time zone,
  CONSTRAINT "content_discoveries_pkey" PRIMARY KEY (id),
  CONSTRAINT "content_discoveries_platform_platform_video_id_key" UNIQUE (platform, platform_video_id),
  CONSTRAINT "content_discoveries_source_url_key" UNIQUE (source_url)
);

ALTER TABLE "public"."content_discoveries"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."content_sources" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "title"               text                     NOT NULL,
  "source_url"          text                     NOT NULL,
  "platform"            text,
  "raw_content_type"    text,
  "archive_category"    text,
  "content_type"        text,
  "source_date"         text,
  "source_location"     text,
  "description"         text,
  "vizard_project_id"   bigint,
  "credits_used"        integer,
  "created_at"          timestamp with time zone DEFAULT now(),
  "updated_at"          timestamp with time zone DEFAULT now(),
  "error_message"       text,
  "retry_count"         integer                  DEFAULT 0,
  "processing_status"   text                     DEFAULT 'pending'::text,
  "download_status"     text                     DEFAULT 'pending'::text,
  "downloaded_filename" text,
  "downloaded_at"       timestamp with time zone,
  "download_error"      text,
  CONSTRAINT "content_sources_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."content_sources"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."discovery_search_state" (
  "query"           text                     NOT NULL,
  "next_page_token" text,
  "pages_searched"  integer                  DEFAULT 0,
  "updated_at"      timestamp with time zone DEFAULT now(),
  "completed"       boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "discovery_search_state_pkey" PRIMARY KEY (query)
);

ALTER TABLE "public"."discovery_search_state"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."fan_analysis" ();

ALTER TABLE "public"."fan_analysis"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."instagram_discoveries" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "platform"               text                     NOT NULL DEFAULT 'instagram'::text,
  "platform_video_id"      text                     NOT NULL,
  "title"                  text                     NOT NULL,
  "description"            text,
  "source_url"             text                     NOT NULL,
  "channel_name"           text,
  "channel_id"             text,
  "published_at"           timestamp with time zone,
  "thumbnail_url"          text,
  "search_query"           text,
  "discovery_score"        integer,
  "suggested_content_type" text,
  "review_status"          text                     NOT NULL DEFAULT 'pending'::text,
  "rejection_reason"       text,
  "discovered_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "reviewed_at"            timestamp with time zone,
  "normalised_source_url"  text,
  "archive_category"       text,
  "imported_at"            timestamp with time zone,
  "music_artist"           text,
  "music_song"             text,
  "uses_original_audio"    boolean,
  "play_count"             bigint,
  "likes_count"            bigint,
  "comments_count"         bigint,
  "video_duration_seconds" numeric,
  "carousel_video_slides"  integer[],
  "carousel_slides"        integer[],
  "parent_short_code"      text,
  "slide_number"           integer,
  "video_url"              text,
  "score_reasons"          text[],
  CONSTRAINT "instagram_discoveries_pkey" PRIMARY KEY (id),
  CONSTRAINT "instagram_discoveries_platform_video_id_key" UNIQUE (platform_video_id)
);

ALTER TABLE "public"."instagram_discoveries"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tiktok_profile_snapshots" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "scraped_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "follower_count"  integer,
  "following_count" integer,
  "likes_total"     bigint,
  "video_count"     integer,
  CONSTRAINT "tiktok_profile_snapshots_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."tiktok_profile_snapshots"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tiktok_videos" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "platform_video_id" text                     NOT NULL,
  "post_date"         timestamp with time zone,
  "caption"           text,
  "views"             bigint,
  "likes"             bigint,
  "comments"          bigint,
  "shares"            bigint,
  "duration_seconds"  integer,
  "content_pillar"    text,
  "video_url"         text,
  "first_scraped_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "last_scraped_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "tiktok_videos_pkey" PRIMARY KEY (id),
  CONSTRAINT "tiktok_videos_platform_video_id_key" UNIQUE (platform_video_id)
);

ALTER TABLE "public"."tiktok_videos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."yt_content" (
  "title"               text,
  "source_url"          text,
  "platform"            text,
  "raw_content_type"    text,
  "archive_category"    text,
  "content_type"        text,
  "source_date"         text,
  "source_location"     text,
  "description"         text,
  "processing_status"   text,
  "download_status"     text                     DEFAULT 'pending'::text,
  "downloaded_filename" text,
  "downloaded_at"       timestamp with time zone,
  "download_error"      text
);

ALTER TABLE "public"."yt_content"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

ALTER TABLE "public"."circa_full_content"
  ADD CONSTRAINT "circa_full_content_duplicate_of_fkey" FOREIGN KEY (duplicate_of) REFERENCES public.circa_full_content(id);

CREATE UNIQUE INDEX circa_full_content_normalised_source_url_key ON public.circa_full_content USING btree (normalised_source_url)
  WHERE (normalised_source_url IS NOT NULL);

CREATE UNIQUE INDEX content_discoveries_normalised_source_url_key ON public.content_discoveries USING btree (normalised_source_url);

CREATE INDEX idx_instagram_discoveries_normalised_source_url ON public.instagram_discoveries USING btree (normalised_source_url);

CREATE INDEX idx_instagram_discoveries_parent_short_code ON public.instagram_discoveries USING btree (parent_short_code);

CREATE INDEX idx_instagram_discoveries_published_at ON public.instagram_discoveries USING btree (published_at);

CREATE INDEX idx_instagram_discoveries_review_status ON public.instagram_discoveries USING btree (review_status);

CREATE INDEX idx_tiktok_profile_snapshots_scraped_at ON public.tiktok_profile_snapshots USING btree (scraped_at);

CREATE INDEX idx_tiktok_videos_content_pillar ON public.tiktok_videos USING btree (content_pillar);

CREATE INDEX idx_tiktok_videos_post_date ON public.tiktok_videos USING btree (post_date);

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."circa_full_content" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."circa_full_content" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."circa_full_content" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."circa_full_content" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."content_discoveries" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."content_discoveries" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."content_discoveries" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."content_discoveries" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."content_sources" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."content_sources" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."content_sources" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."content_sources" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."discovery_search_state" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."discovery_search_state" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."discovery_search_state" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."discovery_search_state" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."fan_analysis" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."fan_analysis" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."fan_analysis" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."fan_analysis" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."instagram_discoveries" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."instagram_discoveries" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."instagram_discoveries" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."instagram_discoveries" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tiktok_profile_snapshots" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."tiktok_profile_snapshots" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tiktok_profile_snapshots" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tiktok_profile_snapshots" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tiktok_videos" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."tiktok_videos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tiktok_videos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tiktok_videos" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."yt_content" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."yt_content" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."yt_content" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."yt_content" TO "service_role";

