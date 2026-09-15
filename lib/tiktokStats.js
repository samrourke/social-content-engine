import { supabaseAdmin } from "./supabaseAdmin";

export async function getTiktokDashboardData() {
  const [
    { data: latestSnapshot },
    { data: firstSnapshot },
    { data: videos },
  ] = await Promise.all([
    supabaseAdmin
      .from("tiktok_profile_snapshots")
      .select("*")
      .order("scraped_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabaseAdmin
      .from("tiktok_profile_snapshots")
      .select("*")
      .order("scraped_at", { ascending: true })
      .limit(1)
      .maybeSingle(),

    supabaseAdmin
      .from("tiktok_videos")
      .select(
        "platform_video_id, post_date, caption, views, likes, comments, shares, duration_seconds, content_pillar, video_url",
      )
      .order("views", { ascending: false }),
  ]);

  const pillars = Array.from(
    new Set(
      (videos ?? [])
        .map((video) => video.content_pillar)
        .filter((pillar) => Boolean(pillar)),
    ),
  ).sort();

  return {
    latestSnapshot: latestSnapshot ?? null,
    firstSnapshot: firstSnapshot ?? null,
    videos: videos ?? [],
    pillars,
  };
}
