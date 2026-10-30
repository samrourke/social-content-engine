/*

Script to fetch bands Instagram posts and store as local JSON file.

TikTok to be added later, 

*/

// scripts/fanAnalysis/01_fetchEngagement.js
//
// Stage 1 of the fan analysis: finds the band's most recent Instagram posts and
// who liked and commented on each one.
//
// Run with:
//   node scripts/fanAnalysis/01_fetchEngagement.js            # reuse posts already scraped
//   node scripts/fanAnalysis/01_fetchEngagement.js --fresh    # re-scrape every post
//
// Likers are the expensive part (~$1.26 a post), so posts already in the newest
// ig-engagement-raw file are copied from it rather than scraped again — only
// posts that are new (or older than the last run reached, or failed last time)
// cost anything. Each reused post records which file it came from.
//
// Nothing is written to Supabase: fan usernames are personal data, so they stay
// local in output/fan-analysis/ (gitignored). Only aggregated results go to the database.
//
// Required env vars (add to .env):
//   APIFY_API_TOKEN=            (already in .env)
//   INSTAGRAM_USERNAME=         optional, defaults to "circawaves" (no @)

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import { ApifyClient } from "apify-client";

dotenv.config({ path: ".env" });

const POSTS_ACTOR_ID = "apify/instagram-scraper";
const LIKES_ACTOR_ID = "iron-crawler/instagram-likes";
const COMMENTS_ACTOR_ID = "apify/instagram-comment-scraper";

const OUTPUT_DIR = "output/fan-analysis";

console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");
console.log(
  `Fetching Instagram engagement data for @${process.env.INSTAGRAM_USERNAME ?? "circawaves"}...`,
);
console.log("Today's Date: " + new Date().toString());
console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");
console.log("");
console.log("");

const POST_COUNT = 10;
// Pinned posts appear first in a profile feed regardless of age, so fetch a few
// extra and sort by date to find the genuinely recent ones.
const PINNED_POST_ALLOWANCE = 3;
// Collab posts owned by another account (e.g. a tour announcement posted by the
// headliner with the band as co-author) show on the band's grid but are seen
// mostly by the other account's audience, so they're skipped. Fetch extra posts
// so there are still POST_COUNT of the band's own after skipping them
const COLLAB_POST_ALLOWANCE = 5;
const MAX_LIKERS_PER_POST = 1000; // caps the cost of each likes run

const MAX_COMMENTS_PER_POST = 50; // caps the cost of each comments run

const { values: args } = parseArgs({
  options: { fresh: { type: "boolean", default: false } },
});

const apifyToken = process.env.APIFY_API_TOKEN;
const bandUsername = process.env.INSTAGRAM_USERNAME ?? "circawaves";

if (!apifyToken) throw new Error("Missing APIFY_API_TOKEN.");

const apify = new ApifyClient({ token: apifyToken });

//Helper function to run Apify actors and return output items:

//actorID - the Apify actor ID to run
//input - the input object to pass to the actor - see the actor's input schema for details
//options - optional, e.g. { maxItems: 1000 } to limit output items - see actor docs for details

async function runActor(actorId, input, options) {
  const run = await apify.actor(actorId).call(input, options);
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items;
}

// Fetches the most recent posts from a given Instagram username (circawaves), sorted by date.

//actorID - apify/instagram-scraper
//input - { directUrls: [profileUrl], resultsType: "posts", resultsLimit: count + allowance }
//See https://console.apify.com/actors/shu8hvrXbJbY3Eb9W/input

async function fetchRecentPosts(username, count) {
  const items = await runActor(POSTS_ACTOR_ID, {
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: "posts",
    resultsLimit: count + PINNED_POST_ALLOWANCE + COLLAB_POST_ALLOWANCE, //will return pinned posts first, so fetch a few extra
  });

  const band = username.toLowerCase();
  const datedPosts = items
    .filter((item) => item.shortCode && item.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Owner is missing on some fallback scrapes; treat those as the band's own
  const isOwnPost = (item) => !item.ownerUsername || item.ownerUsername.toLowerCase() === band;

  for (const item of datedPosts.filter((post) => !isOwnPost(post))) {
    console.log(
      `Skipping collab post ${item.shortCode} (${item.timestamp.slice(0, 10)}, ${item.likesCount ?? "?"} likes), owned by @${item.ownerUsername}`,
    );
  }

  return datedPosts
    .filter(isOwnPost)
    .slice(0, count)
    .map((item) => ({
      shortCode: item.shortCode,
      url: item.url ?? `https://www.instagram.com/p/${item.shortCode}/`,
      timestamp: item.timestamp,
      type: item.type ?? null,
      likesCount: item.likesCount ?? null,
      commentsCount: item.commentsCount ?? null,
      // Other accounts credited on the band's own post, e.g. a photographer
      coauthors: (item.coauthorProducers ?? [])
        .map((coauthor) => coauthor.username)
        .filter((name) => name && name.toLowerCase() !== band),
    }));
}

// Fetches the accounts that liked a post.
//
//actorID - iron-crawler/instagram-likes
//input - { postCode: shortCode } (one post per run)
//output - one item per like: { username, user_id, is_verified, like_timestamp, ... }
//maxItems stops the run (and the billing) once that many likers are found

async function fetchLikers(post) {
  return runActor(
    LIKES_ACTOR_ID,
    { postCode: post.shortCode },
    { maxItems: MAX_LIKERS_PER_POST },
  );
}

//Fetches the acounts that comments on that post
//actorID - apify/instagram-comment-scraper

async function fetchComments(post) {
  return runActor(COMMENTS_ACTOR_ID, {
    directUrls: [post.url],
    resultsLimit: MAX_COMMENTS_PER_POST,
    includeNestedComments: true,
  });
}

// Posts from the newest earlier scrape, keyed by shortCode, so they can be
// reused instead of paid for again. Failed posts are left out so they're retried
function loadPreviousPosts() {
  if (args.fresh || !fs.existsSync(OUTPUT_DIR))
    return { file: null, posts: new Map() };

  const file = fs
    .readdirSync(OUTPUT_DIR)
    .filter(
      (name) => name.startsWith("ig-engagement-raw-") && name.endsWith(".json"),
    )
    .sort()
    .at(-1);
  if (!file) return { file: null, posts: new Map() };

  const raw = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, file), "utf8"));
  const posts = new Map(
    raw.posts
      .filter((post) => !post.error)
      .map((post) => [
        post.shortCode,
        { ...post, scrapedAt: post.scrapedAt ?? raw.scrapedAt },
      ]),
  );
  return { file, posts };
}

// Keeps only user data that later stages need from a liker or comment owner
function slimUser(user) {
  return {
    id: user.id,
    username: user.username,
    is_private: user.is_private,
    is_verified: user.is_verified,
  };
}

async function main() {
  console.log(`Fetching the last ${POST_COUNT} posts from @${bandUsername}...`);

  //Fetch recent posts from the band, sorted by date, ignoring pinned posts
  const posts = await fetchRecentPosts(bandUsername, POST_COUNT);

  //Throw error if no posts.
  if (posts.length === 0) {
    throw new Error(
      "No posts returned — Instagram may have rate-limited the scraper, try again later.",
    );
  }

  const previous = loadPreviousPosts();
  const toScrape = posts.filter((post) => !previous.posts.has(post.shortCode));
  console.log(
    previous.file
      ? `Reusing ${posts.length - toScrape.length} posts from ${previous.file}, scraping ${toScrape.length} (~$${(toScrape.reduce((sum, post) => sum + (post.likesCount ?? 0), 0) * 0.00217).toFixed(2)})`
      : `No earlier scrape to reuse${args.fresh ? " (--fresh)" : ""}, scraping all ${posts.length} posts`,
  );

  //Array to store engagement data

  const engagement = [];

  for (const [index, post] of posts.entries()) {
    console.log(`[${index + 1}/${posts.length}] ${post.url}`);

    const reused = previous.posts.get(post.shortCode);
    if (reused) {
      // Keep the stored likers/comments, but take the latest post details (like counts)
      engagement.push({
        ...post,
        likers: reused.likers,
        comments: reused.comments,
        scrapedAt: reused.scrapedAt,
        reusedFrom: previous.file,
      });
      console.log(
        `  reused ${reused.likers.length} likers, ${reused.comments.length} comments (scraped ${reused.scrapedAt?.slice(0, 10)})`,
      );
      continue;
    }

    //USe try/catch to handle errors so that an error in Post 4 does not crash the
    //whole script and lose data for posts 1-3.

    //map data to slimUser to keep only fields that are needed for
    //later. Minimal data retention. No email, no phone, no address, no IP, etc.

    try {
      const likers = (await fetchLikers(post)).map(slimUser);

      const postComments = (await fetchComments(post)).map((comment) => ({
        id: comment.id,
        timestamp: comment.timestamp,
        owner: slimUser(comment.owner),
      }));

      engagement.push({
        ...post,
        likers,
        comments: postComments,
        scrapedAt: new Date().toISOString(),
      });

      console.log(
        `  got ${likers.length}/${post.likesCount} likers, ${postComments.length}/${post.commentsCount} comments`,
      );
    } catch (err) {
      console.error(`  failed, skipping: ${err.message}`);
      engagement.push({
        ...post,
        error: err.message,
        likers: [],
        comments: [],
      });
    }
  }

  //Timestamp
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  //Filepath for raw JSON output
  const rawPath = `${OUTPUT_DIR}/ig-engagement-raw-${stamp}.json`;

  //Write the raw engagement data to a JSON file in the output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    rawPath,
    JSON.stringify(
      { scrapedAt: new Date().toISOString(), bandUsername, posts: engagement },
      null,
      2,
    ),
  );
  console.log(`Saved to ${rawPath}`);
}

main().catch((err) => {
  console.error("01_fetchEngagement.js failed:", err.message);
  process.exit(1);
});
