// scripts/instagramSearch.js
//
// Searches Instagram for Circa Waves video content via Apify's instagram-scraper,
// filters out the noise (people using a Circa Waves track as background music),
// and stores every post it sees in instagram_discoveries — including rejected
// ones — so repeat scrapes never reach the review queue twice.
//
// Run with:
//   node scripts/instagramSearch.js                  # live run
//   node scripts/instagramSearch.js --dry-run        # scrape + classify, no database reads/writes
//   node scripts/instagramSearch.js --limit 10       # results per search (overrides each search's limit)
//   node scripts/instagramSearch.js --backlog        # ignore the saved date cutoff to work back
//                                                    # through older posts (repeats are still skipped)
//   node scripts/instagramSearch.js --only @circawaves
//                                                    # run a single search by its label
//   node scripts/instagramSearch.js --from-file output/instagram/<file>.json
//                                                    # replay a saved scrape, no Apify cost
//   node scripts/instagramSearch.js --from-file <file> --rescore
//                                                    # re-run the filter on posts it previously
//                                                    # auto-rejected (after changing the rules);
//                                                    # posts you've reviewed are never touched
//
// Every Apify scrape is saved to output/instagram/ so it can be replayed for free
// while tuning the relevance filter.
//
// Required env vars (add to .env):
//   APIFY_API_TOKEN=            (already in .env)
//   NEXT_PUBLIC_SUPABASE_URL=   (already in your .env)
//   SUPABASE_SERVICE_ROLE_KEY=  (already in your .env)
//
// Requires supabase/migrations/003_instagram_discoveries.sql to have been run.

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });

const APIFY_ACTOR_ID = "apify/instagram-scraper";

// Hashtag pages are ranked "top", not newest-first, so the date cutoff may not
// stop the scraper early there — the run summary reports whether it did.
// Profile feeds are date-ordered, so the cutoff works reliably for watched accounts.
// limit        results per run (a --backlog run uses it as how far back to go)
// resultsType  "posts" (default) or "reels". A hashtag's posts feed contains no
//              reels, so hashtags need both. Hashtag reels come back in "top"
//              order, not newest first, so expect repeats on those runs.
// trusted      the band's own accounts: their posts aren't rejected for using a
//              Circa Waves track, and they score higher
const SEARCHES = [
  {
    label: "#circawaves",
    url: "https://www.instagram.com/explore/tags/circawaves/",
    limit: 30,
  },
  {
    label: "#circawaves reels",
    url: "https://www.instagram.com/explore/tags/circawaves/",
    resultsType: "reels",
    limit: 30,
  },
  // Watched accounts
  {
    label: "@circawaves",
    url: "https://www.instagram.com/circawaves/",
    limit: 30,
    trusted: true,
  },
];

const DEFAULT_RESULTS_LIMIT = 30;

// Re-check a couple of days before the last run in case posts are indexed late.
const NEWER_THAN_OVERLAP_DAYS = 2;

const RAW_OUTPUT_DIR = "output/instagram";

const BAND_PATTERN = /circa\s*waves/i;

// Words suggesting the post is footage of the band rather than a track used as a soundtrack.
const LIVE_KEYWORDS = [
  "live",
  "livemusic",
  "gig",
  "concert",
  "festival",
  "tour",
  "setlist",
  "front row",
  "frontrow",
  "encore",
  "moshpit",
  "mosh",
  "interview",
  "backstage",
  "acoustic",
  "session",
  "soundcheck",
  "signing",
  "meet and greet",
];

const { values: args } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    limit: { type: "string" },
    "from-file": { type: "string" },
    rescore: { type: "boolean", default: false },
    backlog: { type: "boolean", default: false },
    only: { type: "string" },
  },
});

const dryRun = args["dry-run"];
const backlog = args.backlog;

function getResultsLimit(search) {
  return Number(args.limit ?? search.limit ?? DEFAULT_RESULTS_LIMIT);
}
const replayFile = args["from-file"];
const rescore = args.rescore;

const apifyToken = process.env.APIFY_API_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");
console.log("RUNNING INSTAGRAM SEARCH SCRIPT");
console.log("Today's Date: " + new Date().toString());
if (dryRun) console.log("DRY RUN — nothing will be read from or written to Supabase");
if (replayFile) console.log(`REPLAY — using saved scrape ${replayFile}`);
if (rescore) console.log("RESCORE — previously auto-rejected posts will be re-assessed");
console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");

if ((!replayFile && !apifyToken) || !supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing APIFY_API_TOKEN or Supabase credentials.");
}

const apify = new ApifyClient({ token: apifyToken });
const supabase = createClient(supabaseUrl, serviceRoleKey);

// ---------------------------------------------------------------------------
// Scraping
// ---------------------------------------------------------------------------

function stateKey(search) {
  return `instagram:${search.label}`;
}

async function getSearchState(search) {
  const { data, error } = await supabase
    .from("discovery_search_state")
    .select("*")
    .eq("query", stateKey(search))
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function saveSearchState(search, runStartedAt) {
  const { error } = await supabase
    .from("discovery_search_state")
    .upsert(
      { query: stateKey(search), updated_at: runStartedAt },
      { onConflict: "query" },
    );

  if (error) throw error;
}

function getCutoff(state) {
  if (!state?.updated_at) return null;

  const cutoff = new Date(state.updated_at);
  cutoff.setUTCDate(cutoff.getUTCDate() - NEWER_THAN_OVERLAP_DAYS);
  return cutoff.toISOString();
}

async function scrape(search, cutoff) {
  const input = {
    directUrls: [search.url],
    resultsType: search.resultsType ?? "posts",
    resultsLimit: getResultsLimit(search),
  };

  if (cutoff) input.onlyPostsNewerThan = cutoff;

  const run = await apify.actor(APIFY_ACTOR_ID).call(input);
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items;
}

function saveRawScrape(search, cutoff, items) {
  fs.mkdirSync(RAW_OUTPUT_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = search.label
    .replace(/^#/, "tag-")
    .replace(/^@/, "user-")
    .replace(/[^a-z0-9-]+/gi, "-");
  const filePath = path.join(RAW_OUTPUT_DIR, `${stamp}-${slug}.json`);

  fs.writeFileSync(
    filePath,
    JSON.stringify({ search, cutoff, fetchedAt: new Date().toISOString(), items }, null, 2),
  );

  return filePath;
}

// ---------------------------------------------------------------------------
// Relevance filter
// ---------------------------------------------------------------------------

function findLiveKeyword(item) {
  const caption = (item.caption ?? "").toLowerCase();
  const hashtags = (item.hashtags ?? []).map((tag) => tag.toLowerCase());

  return LIVE_KEYWORDS.find((keyword) => {
    if (new RegExp(`\\b${keyword}s?\\b`).test(caption)) return true;

    // Only trust compound hashtags that also name the band, e.g. #circawaveslive
    // (plain substring matching would treat #liverpool as "live").
    const compact = keyword.replace(/\s/g, "");
    return hashtags.some((tag) => BAND_PATTERN.test(tag) && tag.includes(compact));
  });
}

function tagsBand(item) {
  const handles = [
    ...(item.mentions ?? []),
    ...(item.taggedUsers ?? []).map((user) => user.username),
    ...(item.coauthorProducers ?? []).map((user) => user.username),
  ].map((handle) => handle?.toLowerCase());

  return handles.includes("circawaves") || /@circawaves\b/i.test(item.caption ?? "");
}

function mentionsBand(item) {
  const text = [item.caption, ...(item.hashtags ?? []), item.ownerUsername].join(" ");

  return BAND_PATTERN.test(text) || tagsBand(item);
}

// Carousels ("Sidecar" posts) can mix photos and videos; count the videos inside.
function countVideos(item) {
  if (item.type === "Video" || item.productType === "clips") return 1;
  return (item.childPosts ?? []).filter((child) => child.type === "Video").length;
}

// 1-based slide positions of the videos in a carousel; null for other posts.
// A lone carousel slide ("carousel_item") opens the whole carousel on Instagram,
// so it's treated as a carousel whose video positions are unknown.
function carouselVideoSlides(item) {
  if (item.productType === "carousel_item") return [];
  if (item.type !== "Sidecar") return null;

  return (item.childPosts ?? []).flatMap((child, index) =>
    child.type === "Video" ? [index + 1] : [],
  );
}

function assessRelevance(item, search) {
  const music = item.musicInfo ?? null;
  const usesLibraryTrack = music?.uses_original_audio === false;
  const keyword = findLiveKeyword(item);
  const isVideo = countVideos(item) > 0;

  const reject = (reason) => ({ status: "auto_rejected", reason, score: 0, keyword });

  if (!isVideo) return reject("Not a video");

  if (!mentionsBand(item)) return reject("No mention of Circa Waves");

  if (usesLibraryTrack && !keyword && !search.trusted) {
    return reject(`Background music only (${music.artist_name} - ${music.song_name})`);
  }

  let score = 0;
  if (music?.uses_original_audio === true) score += 40;
  if (keyword) score += 25;
  if (BAND_PATTERN.test(item.caption ?? "")) score += 15;
  if (tagsBand(item)) score += 10;
  if ((item.videoPlayCount ?? 0) >= 1000) score += 10;
  if (search.trusted) score += 30;

  return { status: "pending", reason: null, score: Math.min(score, 100), keyword };
}

function classifyContent(caption = "") {
  const text = (caption ?? "").toLowerCase();

  if (text.includes("interview") || text.includes("chat") || text.includes("talks to")) {
    return "Interview";
  }

  if (text.includes("backstage") || text.includes("behind the scenes")) {
    return "Backstage";
  }

  if (text.includes("acoustic") || text.includes("session")) {
    return "Studio Session";
  }

  if (
    text.includes("festival") ||
    text.includes("glastonbury") ||
    text.includes("reading festival") ||
    text.includes("leeds festival")
  ) {
    return "Festival";
  }

  if (text.includes("live") || text.includes("concert") || text.includes("gig")) {
    return "Live Performance";
  }

  return "Unknown";
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function normaliseInstagramUrl(shortCode) {
  return `https://www.instagram.com/p/${shortCode}/`;
}

function makeTitle(item) {
  const firstLine = (item.caption ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return `Instagram post by @${item.ownerUsername ?? "unknown"}`;

  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
}

function toRow(item, search, assessment) {
  const normalisedSourceUrl = normaliseInstagramUrl(item.shortCode);

  return {
    platform: "instagram",
    platform_video_id: item.shortCode,
    title: makeTitle(item),
    description: item.caption ?? null,
    source_url: item.url ?? normalisedSourceUrl,
    normalised_source_url: normalisedSourceUrl,
    channel_name: item.ownerUsername ?? null,
    channel_id: item.ownerId ?? null,
    published_at: item.timestamp ?? null,
    thumbnail_url: item.displayUrl ?? null,
    search_query: search.label,
    discovery_score: assessment.score,
    suggested_content_type:
      assessment.status === "pending" ? classifyContent(item.caption) : null,
    review_status: assessment.status,
    rejection_reason: assessment.reason,
    music_artist: item.musicInfo?.artist_name ?? null,
    music_song: item.musicInfo?.song_name ?? null,
    uses_original_audio: item.musicInfo?.uses_original_audio ?? null,
    play_count: item.videoPlayCount ?? null,
    likes_count: item.likesCount ?? null,
    comments_count: item.commentsCount ?? null,
    video_duration_seconds: item.videoDuration ?? null,
    carousel_video_slides: carouselVideoSlides(item),
  };
}

// Returns a Map of shortCode -> review_status for posts already stored.
async function getAlreadySeen(shortCodes) {
  if (shortCodes.length === 0) return new Map();

  const { data, error } = await supabase
    .from("instagram_discoveries")
    .select("platform_video_id, review_status")
    .in("platform_video_id", shortCodes);

  if (error) throw new Error(`Failed to check existing posts: ${error.message}`);

  return new Map(data.map((row) => [row.platform_video_id, row.review_status]));
}

async function getLibraryUrls() {
  const { data, error } = await supabase
    .from("circa_full_content")
    .select("normalised_source_url");

  if (error) throw error;

  return new Set(data.map((row) => row.normalised_source_url).filter(Boolean));
}

async function insertRows(rows) {
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("instagram_discoveries")
    .upsert(rows, { onConflict: "platform_video_id", ignoreDuplicates: true });

  if (error) throw new Error(`Failed to save posts: ${error.message}`);
}

async function updateRows(rows) {
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("instagram_discoveries")
    .upsert(rows, { onConflict: "platform_video_id" });

  if (error) throw new Error(`Failed to update rescored posts: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function describe(item) {
  const date = item.timestamp?.slice(0, 10) ?? "no date";
  const caption = (item.caption ?? "").replace(/\s+/g, " ").slice(0, 70);
  const carousel =
    item.type === "Sidecar" ? ` [carousel, ${countVideos(item)} videos]` : "";
  return `@${item.ownerUsername} ${date}${carousel} "${caption}"`;
}

// The scraper sometimes returns a single slide of a carousel as its own post.
// Map each slide ID to its parent carousel so those duplicates can be filtered.
function mapCarouselSlides(posts) {
  const parents = new Map();

  for (const post of posts) {
    (post.childPosts ?? []).forEach((child, index) => {
      if (child.id) parents.set(String(child.id), { parent: post, slide: index + 1 });
    });
  }

  return parents;
}

async function processItems(search, cutoff, items, seenThisRun, libraryUrls) {
  const errors = items.filter((item) => !item.shortCode);
  const posts = items.filter((item) => item.shortCode);
  const carouselSlides = mapCarouselSlides(posts);

  for (const item of errors) {
    console.log(`Scraper error: ${item.errorDescription ?? item.error ?? JSON.stringify(item)}`);
  }

  const olderThanCutoff = cutoff
    ? posts.filter((item) => item.timestamp && item.timestamp < cutoff).length
    : 0;

  const alreadySeen = dryRun
    ? new Map()
    : await getAlreadySeen(posts.map((item) => item.shortCode));

  const rows = [];
  const rescoredRows = [];
  let repeats = 0;

  for (const item of posts) {
    const canRescore = rescore && alreadySeen.get(item.shortCode) === "auto_rejected";

    if (seenThisRun.has(item.shortCode) || (alreadySeen.has(item.shortCode) && !canRescore)) {
      repeats++;
      continue;
    }

    seenThisRun.add(item.shortCode);

    const parentCarousel =
      item.productType === "carousel_item" ? carouselSlides.get(String(item.id)) : null;

    const assessment = libraryUrls.has(normaliseInstagramUrl(item.shortCode))
      ? { status: "auto_rejected", reason: "Already in library", score: 0 }
      : parentCarousel
        ? {
            status: "auto_rejected",
            reason: `Slide ${parentCarousel.slide} of carousel ${parentCarousel.parent.shortCode}`,
            score: 0,
          }
        : assessRelevance(item, search);

    if (assessment.status === "pending") {
      const keyword = assessment.keyword ? `, "${assessment.keyword}"` : "";
      console.log(`  KEEP (${assessment.score}${keyword}) ${describe(item)}`);
    } else {
      console.log(`  SKIP ${describe(item)} — ${assessment.reason}`);
    }

    (canRescore ? rescoredRows : rows).push(toRow(item, search, assessment));
  }

  if (!dryRun) {
    await insertRows(rows);
    await updateRows(rescoredRows);
  }

  const kept = rows.filter((row) => row.review_status === "pending").length;

  console.log(`\nSummary for ${search.label}:`);
  console.log(`  Returned:        ${posts.length} posts (${errors.length} errors)`);
  if (cutoff) {
    console.log(
      `  Older than cutoff: ${olderThanCutoff}` +
        (olderThanCutoff > 0 ? " — date filter was NOT applied to this search" : " — date filter worked"),
    );
  }
  console.log(`  Already seen:    ${repeats}`);
  console.log(`  New:             ${rows.length} (${kept} for review, ${rows.length - kept} auto-rejected)`);
  if (rescore) {
    const rescoredKept = rescoredRows.filter((row) => row.review_status === "pending").length;
    console.log(`  Rescored:        ${rescoredRows.length} (${rescoredKept} now for review)`);
  }
}

async function main() {
  const runStartedAt = new Date().toISOString();
  const seenThisRun = new Set();
  const libraryUrls = dryRun ? new Set() : await getLibraryUrls();

  if (replayFile) {
    const saved = JSON.parse(fs.readFileSync(replayFile, "utf8"));
    // Prefer the current config for this search so rule changes (e.g. trusted) apply
    const search =
      SEARCHES.find((candidate) => candidate.label === saved.search?.label) ??
      saved.search ?? { label: `replay:${path.basename(replayFile)}` };
    const items = Array.isArray(saved) ? saved : saved.items;

    console.log(`\nReplaying ${items.length} items for ${search.label}`);
    await processItems(search, saved.cutoff ?? null, items, seenThisRun, libraryUrls);
    return;
  }

  const searches = args.only
    ? SEARCHES.filter((search) => search.label === args.only)
    : SEARCHES;

  if (searches.length === 0) {
    throw new Error(`No search labelled "${args.only}"`);
  }

  for (const search of searches) {
    console.log(`\nSearching: ${search.label}`);

    try {
      const state = dryRun ? null : await getSearchState(search);
      const cutoff = backlog ? null : getCutoff(state);
      const limit = getResultsLimit(search);

      console.log(
        cutoff
          ? `Only posts newer than ${cutoff} (last run ${state.updated_at}), up to ${limit} results`
          : `${backlog ? "Backlog run" : "First run"} — no date cutoff, up to ${limit} results`,
      );

      const items = await scrape(search, cutoff);
      const savedTo = saveRawScrape(search, cutoff, items);
      console.log(`Received ${items.length} items (saved to ${savedTo})`);

      await processItems(search, cutoff, items, seenThisRun, libraryUrls);

      if (!dryRun) {
        await saveSearchState(search, runStartedAt);
        console.log(`Saved search progress for: ${search.label}`);
      }
    } catch (error) {
      console.error(`Search failed for "${search.label}":`, error.message);
    }
  }
}

main().catch((err) => {
  console.error("instagramSearch.js failed:", err.message);
  process.exit(1);
});
