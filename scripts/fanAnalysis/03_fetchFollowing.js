// scripts/fanAnalysis/03_fetchFollowing.js
//
// Stage 3 of the fan analysis: fetches who each engaged public fan follows,
// via Apify, for 04_analyse.js to count and cluster.
//
// Run with:
//   node scripts/fanAnalysis/03_fetchFollowing.js            # test run (SAMPLE_SIZE fans)
//
// Required env vars (add to .env):
//   APIFY_API_TOKEN=            (already in .env)

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { ApifyClient } from "apify-client";
import crypto from "node:crypto";

dotenv.config({ path: ".env" });

const FAN_ANALYSIS_DIR = "output/fan-analysis";

// Who counts as an engaged fan worth looking up
const MIN_POSTS_ENGAGED = 2;
// How many fans to look up. Start tiny while testing; ~1,000 is plenty for a full run
const SAMPLE_SIZE = 3;

const FOLLOWING_ACTOR_ID = "publicsignallabs/instagram-following";

// Cap per fan: anyone following more than this gets a partial list.
const MAX_FOLLOWING_PER_FAN = 1000;

const apifyToken = process.env.APIFY_API_TOKEN;
if (!apifyToken) throw new Error("Missing APIFY_API_TOKEN.");

const apify = new ApifyClient({ token: apifyToken });

async function runActor(actorId, input, options) {
  const run = await apify.actor(actorId).call(input, options);
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items;
}

// Fetches the accounts a fan follows.
//
//actorID - publicsignallabs/instagram-following
//input - { Account: [username], resultsLimit } (one account per run on the free plan)
//output - one item per followed account: { id, username, full_name, is_verified, is_private, username_scrape, ... }
//maxItems stops the run (and the billing) at the same cap

async function fetchFollowing(fan, limit = MAX_FOLLOWING_PER_FAN) {
  const items = await runActor(
    FOLLOWING_ACTOR_ID,
    { Account: [fan.username], resultsLimit: limit },
    { maxItems: limit },
  );

  return items;
}

// Keeps only what the analysis needs from a followed account
function slimFollowed(account) {
  return {
    id: account.id,
    username: account.username,
    full_name: account.full_name,
    is_verified: account.is_verified,
  };
}

// Replaces a fan's Instagram ID with a scrambled one, so the saved follow
// data can't be traced back to a person. The same ID always gives the same
// result, so a fan can still be matched across files
function pseudonymise(fanId) {
  return crypto
    .createHash("sha256")
    .update(String(fanId))
    .digest("hex")
    .slice(0, 12);
}

async function fetchAllFollowing(fans) {
  const results = [];

  for (const [index, fan] of fans.entries()) {
    console.log(`[${index + 1}/${fans.length}] fetching follows...`);

    try {
      const following = await fetchFollowing(fan);
      // Private accounts a fan follows are almost always friends and family:
      // no use to the analysis, and private individuals' data, so drop them now
      const publicFollowing = following.filter(
        (account) => !account.is_private,
      );

      results.push({
        fanId: pseudonymise(fan.id),
        score: fan.score,
        followingFetched: following.length,
        following: publicFollowing.map(slimFollowed),
      });

      console.log(
        `  ${following.length} follows, ${publicFollowing.length} public kept`,
      );
    } catch (err) {
      // Fan went private, renamed or deleted their account since stage 1
      console.error(`  failed, skipping: ${err.message}`);
      results.push({ fanId: fan.id, error: err.message, following: [] });
    }
  }

  return results;
}

function loadLatestFans() {
  const fanFiles = fs
    .readdirSync(FAN_ANALYSIS_DIR)
    .filter((file) => file.startsWith("ig-fans-") && file.endsWith(".json"))
    .sort();

  if (fanFiles.length === 0) {
    throw new Error(
      `No ig-fans-*.json files in ${FAN_ANALYSIS_DIR} — run 02_mergeFanProfiles.js first.`,
    );
  }

  const latestFile = fanFiles.at(-1);
  console.log(`Using ${latestFile}`);

  return {
    file: latestFile,
    fans: JSON.parse(
      fs.readFileSync(path.join(FAN_ANALYSIS_DIR, latestFile), "utf8"),
    ),
  };
}

function selectFans(fans) {
  const eligible = fans.filter(
    (fan) =>
      !fan.is_private &&
      !fan.is_verified &&
      fan.postsEngaged >= MIN_POSTS_ENGAGED,
  );

  // Random sample, so the results describe engaged fans in general rather
  // than just the very top scorers
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);

  console.log(
    `${eligible.length} eligible fans (public, not verified, ${MIN_POSTS_ENGAGED}+ posts)`,
  );
  return shuffled.slice(0, SAMPLE_SIZE);
}

async function main() {
  const { file, fans } = loadLatestFans();
  const selected = selectFans(fans);
  console.log(`Selected ${selected.length} fans to look up`);

  const results = await fetchAllFollowing(selected);
  const totalRows = results.reduce(
    (sum, result) => sum + (result.followingFetched ?? 0),
    0,
  );
  console.log(
    `Done: ${totalRows} rows fetched (~$${((totalRows / 1000) * 0.5).toFixed(2)} at $0.50/1k)`,
  );
  const outputPath = path.join(
    FAN_ANALYSIS_DIR,
    file.replace("ig-fans-", "ig-following-"),
  );
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("03_fetchFollowing.js failed:", err.message);
  process.exit(1);
});
