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
//                                                    # re-run the filter and ranking on posts
//                                                    # that are auto-rejected or still pending
//                                                    # (after changing the rules); posts you've
//                                                    # reviewed are never touched
//   node scripts/instagramSearch.js --refresh        # renew the expiring video links of pending
//                                                    # carousel slides (re-scrapes just those posts)
//
// Carousels are split into one review row per video slide (see
// supabase/migrations/005_instagram_split_slides.sql), so each clip is reviewed
// on its own. The queue is ranked by lib/instagramScoring.js.
//
// Every Apify scrape is saved to output/instagram/ so it can be replayed for free
// while tuning the relevance filter.
//
// Required env vars (add to .env):
//   APIFY_API_TOKEN=            (already in .env)
//   NEXT_PUBLIC_SUPABASE_URL=   (already in your .env)
//   SUPABASE_SERVICE_ROLE_KEY=  (already in your .env)
//
// Requires supabase/migrations/003, 004 and 005 to have been run.

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import { ApifyClient } from "apify-client";
import { createClient } from "@supabase/supabase-js";
import {
  assessRelevance,
  assessSlide,
  classifyContent,
  countVideos,
} from "../lib/instagramScoring.js";

dotenv.config({ path: ".env" });

const APIFY_ACTOR_ID = "apify/instagram-scraper";

// Hashtag pages are ranked "top", not newest-first, so the date cutoff may not
// stop the scraper early there — the run summary reports whether it did.
// Profile feeds are date-ordered, so the cutoff works reliably for watched accounts.
// limit        results per run (a --backlog run uses it as how far back to go)
// resultsType  "posts" (default) or "reels". A hashtag's posts feed contains no
//              reels, so hashtags need both. Hashtag reels come back in "top"
//              order, not newest first, so expect repeats on those runs.
// trusted      the band's own accounts: their posts aren't auto-rejected for using
//              a Circa Waves track (they're ranked low instead, as that's usually promo)
//
// The hashtag searches cast a wide net (most results are photos, dropped before
// ranking); the scoring in lib/instagramScoring.js sorts what's left.
const SEARCHES = [
  {
    label: "#circawaves",
    url: "https://www.instagram.com/explore/tags/circawaves/",
    limit: 1000,
  },
  {
    label: "#circawaves reels",
    url: "https://www.instagram.com/explore/tags/circawaves/",
    resultsType: "reels",
    limit: 1000,
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

const { values: args } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    limit: { type: "string" },
    "from-file": { type: "string" },
    rescore: { type: "boolean", default: false },
    backlog: { type: "boolean", default: false },
    only: { type: "string" },
    refresh: { type: "boolean", default: false },
  },
});

const dryRun = args["dry-run"];
const backlog = args.backlog;

function getResultsLimit(search) {
  return Number(args.limit ?? search.limit ?? DEFAULT_RESULTS_LIMIT);
}
const replayFile = args["from-file"];
const rescore = args.rescore;
const refresh = args.refresh;

// Statuses --rescore may overwrite: never anything you've reviewed. A split
// carousel is rescored slide by slide, skipping slides already reviewed.
const RESCORABLE = new Set(["auto_rejected", "pending", "split"]);

const apifyToken = process.env.APIFY_API_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");
console.log("RUNNING INSTAGRAM SEARCH SCRIPT");
console.log("Today's Date: " + new Date().toString());
if (dryRun) console.log("DRY RUN — nothing will be read from or written to Supabase");
if (replayFile) console.log(`REPLAY — using saved scrape ${replayFile}`);
if (rescore) console.log("RESCORE — auto-rejected and pending posts will be re-assessed");
if (refresh) console.log("REFRESH — renewing video links for pending carousel slides");
console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");

if (((!replayFile || refresh) && !apifyToken) || !supabaseUrl || !serviceRoleKey) {
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
// Carousels
// ---------------------------------------------------------------------------

// 1-based slide positions of the videos in a carousel; null for other posts.
// A lone carousel slide ("carousel_item") opens the whole carousel on Instagram,
// so it's treated as a carousel whose video positions are unknown.
function carouselVideoSlides(item) {
  if (item.productType === "carousel_item") return [];
  if (item.type !== "Sidecar") return null;

  return videoSlides(item).map(({ slide }) => slide);
}

// [{ child, slide }] for each video in a carousel, slide being its 1-based position.
function videoSlides(item) {
  return (item.childPosts ?? []).flatMap((child, index) =>
    child.type === "Video" ? [{ child, slide: index + 1 }] : [],
  );
}

function slideId(shortCode, slide) {
  return `${shortCode}-slide${slide}`;
}

// Instagram opens a carousel at a given slide with ?img_index=N; yt-dlp ignores
// the query, and downloads just that slide via carousel_slides.
function slideUrl(shortCode, slide) {
  return `${normaliseInstagramUrl(shortCode)}?img_index=${slide}`;
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
    score_reasons: assessment.reasons ?? [],
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
    // A lone carousel slide can be played directly, as its position is unknown
    video_url: item.productType === "carousel_item" ? (item.videoUrl ?? null) : null,
  };
}

// One review row per video slide of a split carousel.
function toSlideRow(item, { child, slide }, search, assessment) {
  const url = slideUrl(item.shortCode, slide);

  return {
    ...toRow(item, search, assessment),
    platform_video_id: slideId(item.shortCode, slide),
    source_url: url,
    normalised_source_url: url,
    parent_short_code: item.shortCode,
    slide_number: slide,
    video_url: child.videoUrl ?? null,
    thumbnail_url: child.displayUrl ?? item.displayUrl ?? null,
    video_duration_seconds: child.videoDuration ?? null,
    play_count: child.videoPlayCount ?? null,
  };
}

// Returns a Map of shortCode -> review_status for posts already stored.
// Checked in chunks, as a wide scrape has too many codes for one request URL.
async function getAlreadySeen(shortCodes) {
  const seen = new Map();
  const CHUNK = 200;

  for (let start = 0; start < shortCodes.length; start += CHUNK) {
    const { data, error } = await supabase
      .from("instagram_discoveries")
      .select("platform_video_id, review_status")
      .in("platform_video_id", shortCodes.slice(start, start + CHUNK));

    if (error) throw new Error(`Failed to check existing posts: ${error.message}`);

    for (const row of data) seen.set(row.platform_video_id, row.review_status);
  }

  return seen;
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
    : await getAlreadySeen(
        posts.flatMap((item) => [
          item.shortCode,
          ...(rescore ? videoSlides(item).map(({ slide }) => slideId(item.shortCode, slide)) : []),
        ]),
      );

  const rows = [];
  const rescoredRows = [];
  let repeats = 0;

  for (const item of posts) {
    const canRescore = rescore && RESCORABLE.has(alreadySeen.get(item.shortCode));

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
      console.log(`  KEEP (${assessment.score}) ${describe(item)}`);
      if (assessment.reasons.length) console.log(`       ${assessment.reasons.join(", ")}`);
    } else {
      console.log(`  SKIP ${describe(item)} — ${assessment.reason}`);
    }

    const target = canRescore ? rescoredRows : rows;
    const slides = item.type === "Sidecar" ? videoSlides(item) : [];

    // A relevant carousel is reviewed slide by slide; its own row only marks it seen
    if (assessment.status === "pending" && slides.length > 0) {
      target.push(toRow(item, search, { ...assessment, status: "split" }));

      for (const videoSlide of slides) {
        const existing = alreadySeen.get(slideId(item.shortCode, videoSlide.slide));
        if (existing && !RESCORABLE.has(existing)) continue;

        const slideAssessment = libraryUrls.has(slideUrl(item.shortCode, videoSlide.slide))
          ? { status: "auto_rejected", reason: "Already in library", score: 0, reasons: [] }
          : assessSlide(assessment, videoSlide.child);

        target.push(toSlideRow(item, videoSlide, search, slideAssessment));
      }
    } else {
      target.push(toRow(item, search, assessment));
    }
  }

  if (!dryRun) {
    await insertRows(rows);
    await updateRows(rescoredRows);
  }

  const kept = rows.filter((row) => row.review_status === "pending").length;
  const split = rows.filter((row) => row.review_status === "split").length;

  console.log(`\nSummary for ${search.label}:`);
  console.log(`  Returned:        ${posts.length} posts (${errors.length} errors)`);
  if (cutoff) {
    console.log(
      `  Older than cutoff: ${olderThanCutoff}` +
        (olderThanCutoff > 0 ? " — date filter was NOT applied to this search" : " — date filter worked"),
    );
  }
  console.log(`  Already seen:    ${repeats}`);
  console.log(
    `  New rows:        ${rows.length} (${kept} for review, ` +
      `${rows.length - kept - split} auto-rejected, ${split} carousels split into slides)`,
  );
  if (rescore) {
    const rescoredKept = rescoredRows.filter((row) => row.review_status === "pending").length;
    console.log(`  Rescored rows:   ${rescoredRows.length} (${rescoredKept} now for review)`);
  }
}

// ---------------------------------------------------------------------------
// Refreshing slide video links
// ---------------------------------------------------------------------------

// Pending rows that play a video file directly, whose CDN links expire.
async function getPendingVideoRows() {
  const { data, error } = await supabase
    .from("instagram_discoveries")
    .select("id, platform_video_id, parent_short_code, slide_number")
    .eq("review_status", "pending")
    .not("video_url", "is", null);

  if (error) throw error;

  return data;
}

// Re-scrapes just the posts behind pending slides and stores fresh video links.
async function refreshVideoLinks() {
  const rows = await getPendingVideoRows();
  const shortCodes = [
    ...new Set(rows.map((row) => row.parent_short_code ?? row.platform_video_id)),
  ];

  console.log(`${rows.length} pending video rows across ${shortCodes.length} posts`);
  if (shortCodes.length === 0) return;

  const run = await apify.actor(APIFY_ACTOR_ID).call({
    directUrls: shortCodes.map(normaliseInstagramUrl),
    resultsType: "posts",
    resultsLimit: 1,
  });
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  const posts = new Map(
    items.filter((item) => item.shortCode).map((item) => [item.shortCode, item]),
  );

  let refreshed = 0;
  const missing = [];

  for (const row of rows) {
    const post = posts.get(row.parent_short_code ?? row.platform_video_id);
    const media = row.slide_number
      ? post?.childPosts?.[row.slide_number - 1]
      : post;

    if (!media?.videoUrl) {
      missing.push(row.platform_video_id);
      continue;
    }

    if (!dryRun) {
      const { error } = await supabase
        .from("instagram_discoveries")
        .update({ video_url: media.videoUrl, thumbnail_url: media.displayUrl ?? null })
        .eq("id", row.id);

      if (error) throw error;
    }

    refreshed++;
  }

  console.log(`Refreshed ${refreshed} video links`);
  if (missing.length) {
    console.log(`No video returned for ${missing.length} (deleted or private?): ${missing.join(", ")}`);
  }
}

async function main() {
  const runStartedAt = new Date().toISOString();
  const seenThisRun = new Set();

  if (refresh) {
    await refreshVideoLinks();
    return;
  }

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
