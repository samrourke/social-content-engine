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
//   node scripts/fanAnalysis/01_fetchEngagement.js
//
// Nothing is written to Supabase: fan usernames are personal data, so they stay
// local in output/fan-analysis/ (gitignored). Only aggregated results go to the database.
//
// Required env vars (add to .env):
//   APIFY_API_TOKEN=            (already in .env)
//   INSTAGRAM_USERNAME=         optional, defaults to "circawaves" (no @)

import fs from "node:fs";
import dotenv from "dotenv";
import { ApifyClient } from "apify-client";

dotenv.config({ path: ".env" });

const POSTS_ACTOR_ID = "apify/instagram-scraper";
const LIKES_ACTOR_ID = "iron-crawler/instagram-likes";

const OUTPUT_DIR = "output/fan-analysis";

console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");
console.log(
  `Fetching Instagram engagement data for @${process.env.INSTAGRAM_USERNAME ?? "circawaves"}...`,
);
console.log("Today's Date: " + new Date().toString());
console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");
console.log("");
console.log("");

const POST_COUNT = 5;
// Pinned posts appear first in a profile feed regardless of age, so fetch a few
// extra and sort by date to find the genuinely recent ones.
const PINNED_POST_ALLOWANCE = 3;
const MAX_LIKERS_PER_POST = 1000; // caps the cost of each likes run

const apifyToken = process.env.APIFY_API_TOKEN;
const bandUsername = process.env.INSTAGRAM_USERNAME ?? "circawaves";

if (!apifyToken) throw new Error("Missing APIFY_API_TOKEN.");

const apify = new ApifyClient({ token: apifyToken });

// Fetches the most recent posts from a given Instagram username, sorted by date.

//actorID - apify/instagram-scraper
//input - { directUrls: [profileUrl], resultsType: "posts", resultsLimit: count + allowance }
//See https://console.apify.com/actors/shu8hvrXbJbY3Eb9W/input

async function runActor(actorId, input, options) {
  const run = await apify.actor(actorId).call(input, options);
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items;
}

async function fetchRecentPosts(username, count) {
  const items = await runActor(POSTS_ACTOR_ID, {
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: "posts",
    resultsLimit: count + PINNED_POST_ALLOWANCE, //will return pinned posts first, so fetch a few extra
  });

  return items
    .filter((item) => item.shortCode && item.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, count)
    .map((item) => ({
      shortCode: item.shortCode,
      url: item.url ?? `https://www.instagram.com/p/${item.shortCode}/`,
      timestamp: item.timestamp,
      type: item.type ?? null,
      likesCount: item.likesCount ?? null,
      commentsCount: item.commentsCount ?? null,
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

async function main() {
  console.log(`Fetching the last ${POST_COUNT} posts from @${bandUsername}...`);
  const posts = await fetchRecentPosts(bandUsername, POST_COUNT);

  if (posts.length === 0) {
    throw new Error("No posts returned — Instagram may have rate-limited the scraper, try again later.");
  }

  console.table(posts);

  // Step 2 test: likers for just the cheapest post, to check the actor's output
  const testPost = [...posts].sort((a, b) => a.likesCount - b.likesCount)[0];
  console.log(`Fetching likers for ${testPost.url} (${testPost.likesCount} likes)...`);
  const likers = await fetchLikers(testPost);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(`${OUTPUT_DIR}/test-likers.json`, JSON.stringify(likers, null, 2));

  console.log(`Got ${likers.length} likers (Instagram shows ${testPost.likesCount}).`);
  console.log("First liker:", likers[0]);
  console.log(`Saved to ${OUTPUT_DIR}/test-likers.json`);
}

main().catch((err) => {
  console.error("01_fetchEngagement.js failed:", err.message);
  process.exit(1);
});
