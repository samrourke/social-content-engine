export async function getTiktokDashboardData(supabase, clientId) {
  const [{ data: latestSnapshot }, { data: firstSnapshot }, { data: videos }] =
    await Promise.all([
      //latest snapshot
      supabase
        .from("tiktok_profile_snapshots")
        .select("*")
        .eq("client_id", clientId)
        .order("scraped_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      //first snapshot
      supabase
        .from("tiktok_profile_snapshots")
        .select("*")
        .eq("client_id", clientId)
        .order("scraped_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      //videos
      supabase
        .from("tiktok_videos")
        .select(
          "platform_video_id, post_date, caption, views, likes, comments, shares, duration_seconds, content_pillar, video_url",
        )
        .eq("client_id", clientId)
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
