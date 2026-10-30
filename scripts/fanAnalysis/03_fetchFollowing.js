// scripts/fanAnalysis/03_fetchFollowing.js
//
// Stage 3 of the fan analysis: fetches who each engaged public fan follows,
// via Apify, for 04_analyse.js to count and cluster.
//
// Run with:
//   node scripts/fanAnalysis/03_fetchFollowing.js            # new run (SAMPLE_SIZE fans)
//   node scripts/fanAnalysis/03_fetchFollowing.js --resume output/fan-analysis/ig-following-<stamp>.json
//                                                            # carry on an interrupted run
//
// Progress is saved after every fan, so stopping partway (Ctrl+C, a crash, a
// spending limit) keeps everything fetched so far. --resume skips fans already
// in that file and samples new ones until it holds SAMPLE_SIZE fans.
//
// Required env vars (add to .env):
//   APIFY_API_TOKEN=            (already in .env)

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { ApifyClient } from "apify-client";
import crypto from "node:crypto";
import { parseArgs } from "node:util";

dotenv.config({ path: ".env" });

const FAN_ANALYSIS_DIR = "output/fan-analysis";

// Who counts as an engaged fan worth looking up
const MIN_POSTS_ENGAGED = 2;
// How many fans to look up. Start tiny while testing; ~1,000 is plenty for a full run
const SAMPLE_SIZE = 3;

const FOLLOWING_ACTOR_ID = "publicsignallabs/instagram-following";

// Cap per fan: anyone following more than this gets a partial list.
const MAX_FOLLOWING_PER_FAN = 1000;
// What the following actor charges per row returned, for the running cost estimate
const COST_PER_1000_ROWS = 0.5;

const { values: args } = parseArgs({
  options: { resume: { type: "string" } },
});

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

// Writes to a temporary file then renames it, so stopping the script mid-write
// can't leave a half-written (unreadable) results file
function saveResults(outputPath, results) {
  const tempPath = `${outputPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(results, null, 2));
  fs.renameSync(tempPath, outputPath);
}

function estimateCost(results) {
  const rows = results.reduce((sum, result) => sum + (result.followingFetched ?? 0), 0);
  return { rows, cost: (rows / 1000) * COST_PER_1000_ROWS };
}

// results may already hold fans from an earlier, interrupted run (--resume);
// new fans are added to it and the file is saved after each one
async function fetchAllFollowing(fans, results, outputPath) {
  const alreadyDone = results.length;

  for (const [index, fan] of fans.entries()) {
    console.log(
      `[${alreadyDone + index + 1}/${alreadyDone + fans.length}] fetching follows...`,
    );

    try {
      const following = await fetchFollowing(fan);
      // The actor returns no rows, rather than an error, for an account it can't
      // read, so treat an empty list as a failure or it lowers every share in 04
      if (following.length === 0) {
        throw new Error("no follows returned (private, renamed or deleted?)");
      }
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

      const { cost } = estimateCost(results);
      console.log(
        `  ${following.length} follows, ${publicFollowing.length} public kept (run total ~$${cost.toFixed(2)})`,
      );
    } catch (err) {
      // Fan went private, renamed or deleted their account since stage 1
      console.error(`  failed, skipping: ${err.message}`);
      results.push({
        fanId: pseudonymise(fan.id),
        error: err.message,
        following: [],
      });
    }

    saveResults(outputPath, results);
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

// doneFanIds: scrambled IDs of fans already fetched (when resuming), so they
// aren't fetched and paid for twice
function selectFans(fans, doneFanIds, count) {
  const eligible = fans.filter(
    (fan) =>
      !fan.is_private &&
      !fan.is_verified &&
      fan.postsEngaged >= MIN_POSTS_ENGAGED,
  );
  const remaining = eligible.filter((fan) => !doneFanIds.has(pseudonymise(fan.id)));

  // Random sample, so the results describe engaged fans in general rather
  // than just the very top scorers
  const shuffled = [...remaining].sort(() => Math.random() - 0.5);

  console.log(
    `${eligible.length} eligible fans (public, not verified, ${MIN_POSTS_ENGAGED}+ posts)`,
  );
  return shuffled.slice(0, count);
}

async function main() {
  const { fans } = loadLatestFans();

  let outputPath;
  let results = [];

  if (args.resume) {
    outputPath = args.resume;
    results = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    console.log(`Resuming ${outputPath}: ${results.length} fans already fetched`);
  } else {
    // Each run samples different fans, so name the output after this run rather
    // than the ig-fans file it sampled from, so a re-run never overwrites paid data
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    outputPath = path.join(FAN_ANALYSIS_DIR, `ig-following-${stamp}.json`);
  }

  const doneFanIds = new Set(results.map((result) => result.fanId));
  const selected = selectFans(fans, doneFanIds, SAMPLE_SIZE - results.length);
  console.log(`Selected ${selected.length} fans to look up, saving to ${outputPath}`);

  await fetchAllFollowing(selected, results, outputPath);

  const { rows, cost } = estimateCost(results);
  console.log(
    `Done: ${results.length} fans, ${rows} rows fetched (~$${cost.toFixed(2)} at $${COST_PER_1000_ROWS}/1k)`,
  );
  console.log(`Saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("03_fetchFollowing.js failed:", err.message);
  process.exit(1);
});
