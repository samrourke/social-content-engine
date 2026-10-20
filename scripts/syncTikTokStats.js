// scripts/syncTikTokStats.js
//
// Pulls current TikTok profile + video stats for the band via Apify and
// upserts them into Supabase (tiktok_profile_snapshots, tiktok_videos).
//
// Run with:
//   node scripts/syncTikTokStats.js
//
// Required env vars (add to .env):
//   APIFY_API_TOKEN=
//   TIKTOK_USERNAME=            e.g. "circawaves" (no @)
//   NEXT_PUBLIC_SUPABASE_URL=   (already in your .env)
//   SUPABASE_SERVICE_ROLE_KEY=  (already in your .env)

import dotenv from "dotenv";
import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });

const APIFY_ACTOR_ID = "clockworks/tiktok-scraper";
const RESULTS_PER_PAGE = 100; // how many recent videos to pull per run

const apifyToken = process.env.APIFY_API_TOKEN;
const tikTokUsername = process.env.TIKTOK_USERNAME;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const apify = new ApifyClient({ token: apifyToken });
const supabase = createClient(supabaseUrl, serviceRoleKey);

const { error: dbCheck } = await supabase
  .from("tiktok_videos")
  .select("*")
  .limit(1);
if (dbCheck)
  throw new Error(`Supabase unreachable, skipping scrape: ${dbCheck.message}`);

console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");
console.log(`Syncing TikTok stats for @${tikTokUsername}...`);
console.log("Today's Date: " + new Date().toString());
console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");
console.log("");
console.log("");

if (!apifyToken || !tikTokUsername || !supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing APIFY_API_TOKEN, TIKTOK_USERNAME, or Supabase credentials.",
  );
}

async function fetchTikTokData(username) {
  const run = await apify.actor(APIFY_ACTOR_ID).call({
    profiles: [username],
    resultsPerPage: RESULTS_PER_PAGE,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  });

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items;
}

function extractProfileSnapshot(items) {
  // Every video item carries an authorMeta block with current profile-level stats.
  // Take it from the first item that has one.
  const withAuthor = items.find((item) => item.authorMeta);
  if (!withAuthor) return null;

  const author = withAuthor.authorMeta;
  return {
    scraped_at: new Date().toISOString(),
    follower_count: author.fans ?? null,
    following_count: author.following ?? null,
    likes_total: author.heart ?? null,
    video_count: author.video ?? null,
  };
}

function extractVideoRows(items) {
  const now = new Date().toISOString();

  return items
    .filter((item) => item.id) // skip malformed entries
    .map((item) => ({
      platform_video_id: String(item.id),
      post_date:
        item.createTimeISO ??
        (item.createTime
          ? new Date(item.createTime * 1000).toISOString()
          : null),
      caption: item.text ?? null,
      views: item.playCount ?? null,
      likes: item.diggCount ?? null,
      comments: item.commentCount ?? null,
      shares: item.shareCount ?? null,
      duration_seconds: item.videoMeta?.duration ?? null,
      video_url: item.webVideoUrl ?? null,
      last_scraped_at: now,
      updated_at: now,
    }));
}

async function upsertProfileSnapshot(snapshot) {
  if (!snapshot) {
    console.log(
      "No profile metadata found in scrape results — skipping snapshot.",
    );
    return;
  }

  const { error } = await supabase
    .from("tiktok_profile_snapshots")
    .insert(snapshot);
  if (error)
    throw new Error(`Failed to insert profile snapshot: ${error.message}`);

  console.log(
    `Profile snapshot recorded: ${snapshot.follower_count} followers, ${snapshot.video_count} videos.`,
  );
}

async function upsertVideoRows(rows) {
  if (rows.length === 0) {
    console.log("No video rows to upsert.");
    return { inserted: 0, updated: 0 };
  }

  // Preserve first_scraped_at for rows that already exist by fetching existing IDs first.
  const ids = rows.map((row) => row.platform_video_id);
  const { data: existing, error: fetchError } = await supabase
    .from("tiktok_videos")
    .select("platform_video_id")
    .in("platform_video_id", ids);

  if (fetchError)
    throw new Error(`Failed to check existing videos: ${fetchError.message}`);

  const existingIds = new Set(
    (existing ?? []).map((row) => row.platform_video_id),
  );
  // New and existing rows go in separate requests: when rows in one request have
  // different keys, supabase-js sends missing keys as null, which would null out
  // first_scraped_at on the existing rows.
  const newRows = rows
    .filter((row) => !existingIds.has(row.platform_video_id))
    .map((row) => ({ ...row, first_scraped_at: row.last_scraped_at }));
  const existingRows = rows.filter((row) =>
    existingIds.has(row.platform_video_id),
  );

  if (newRows.length > 0) {
    const { error: insertError } = await supabase
      .from("tiktok_videos")
      .insert(newRows);

    if (insertError)
      throw new Error(`Failed to insert videos: ${insertError.message}`);
  }

  if (existingRows.length > 0) {
    const { error: upsertError } = await supabase
      .from("tiktok_videos")
      .upsert(existingRows, { onConflict: "platform_video_id" });

    if (upsertError)
      throw new Error(`Failed to update videos: ${upsertError.message}`);
  }

  return { inserted: newRows.length, updated: existingRows.length };
}

async function main() {
  console.log(`Fetching TikTok data for @${tikTokUsername} via Apify...`);
  const items = await fetchTikTokData(tikTokUsername);
  console.log(`Received ${items.length} items from scrape.`);

  const profileSnapshot = extractProfileSnapshot(items);
  await upsertProfileSnapshot(profileSnapshot);

  const videoRows = extractVideoRows(items);
  const { inserted, updated } = await upsertVideoRows(videoRows);

  console.log("---");
  console.log("Sync summary:");
  console.log(`  Videos inserted: ${inserted}`);
  console.log(`  Videos updated:  ${updated}`);
  console.log(
    `  Profile snapshot: ${profileSnapshot ? "recorded" : "skipped (no data)"}`,
  );
}

main().catch((err) => {
  console.error("syncTikTokStats.js failed:", err.message);
  process.exit(1);
});
