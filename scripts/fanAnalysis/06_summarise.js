// scripts/fanAnalysis/06_summarise.js
//
// Stage 6 of the fan analysis: turns categorised accounts into fan-level shares —
// what percentage of engaged fans follow at least one account in each category,
// subcategory and team. The output holds totals only, no fan data.
//
// Run with:
//   node scripts/fanAnalysis/06_summarise.js
//
// Saves the summary locally (ig-summary-<stamp>.json) and to the fan_analysis
// table in Supabase, which the live /fan-analysis page reads. Re-running it on
// the same data updates that run's row rather than adding another.
//
// Required env vars (already in .env):
//   NEXT_PUBLIC_SUPABASE_URL=
//   SUPABASE_SERVICE_ROLE_KEY=
//   INSTAGRAM_USERNAME=         optional, defaults to "circawaves" (no @)
//
// Requires supabase/migrations/20261030081849_fan_analysis_columns.sql to have been run.

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });

const FAN_ANALYSIS_DIR = "output/fan-analysis";
const ARTIST = process.env.INSTAGRAM_USERNAME ?? "circawaves";
const PLATFORM = "instagram";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
}
const supabase = createClient(supabaseUrl, serviceRoleKey);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(FAN_ANALYSIS_DIR, file), "utf8"));
}

function loadInputs() {
  const categorisedFile = fs
    .readdirSync(FAN_ANALYSIS_DIR)
    .filter(
      (file) =>
        file.startsWith("ig-accounts-categorised-") && file.endsWith(".json"),
    )
    .sort()
    .at(-1);

  if (!categorisedFile) {
    throw new Error("No ig-accounts-categorised-*.json files — run 05 first.");
  }

  // The follow lists must come from the same 03 run the categories were built
  // from, so use the matching timestamp rather than the newest file
  const followingFile = categorisedFile.replace(
    "ig-accounts-categorised-",
    "ig-following-",
  );
  if (!fs.existsSync(path.join(FAN_ANALYSIS_DIR, followingFile))) {
    throw new Error(
      `Missing ${followingFile}, which ${categorisedFile} was built from.`,
    );
  }

  console.log(`Summarising ${categorisedFile} with ${followingFile}`);
  return {
    stamp: categorisedFile.replace("ig-accounts-categorised-", ""),
    accounts: readJson(categorisedFile),
    fans: readJson(followingFile).filter((fan) => !fan.error),
  };
}

function buildClassificationLookup(accounts) {
  const lookup = new Map();
  for (const account of accounts) {
    lookup.set(account.id, account.classification);
  }
  console.log("look up ", lookup);
  return lookup;
}

/* returns
    {  
        {'followed account id number' => 
            {
            category: 'num',
            subcategory: 'num',
            team: 'num',
            sensitive: 'boolean',
            },
        }
    ....etc
    } 
for every account analysed for easy look up later
   */

// For each fan, collect the set of categories/subcategories/teams they follow
// at least one account in,
// Then count how many fans have each category, sub category and team
function countFans(fans, lookup) {
  const counts = {
    category: new Map(),
    subcategory: new Map(),
    team: new Map(),
  };

  for (const fan of fans) {
    const seen = {
      category: new Set(),
      subcategory: new Set(),
      team: new Set(),
    };

    for (const account of fan.following) {
      const classification = lookup.get(account.id);
      if (!classification) continue;

      for (const field of ["category", "subcategory", "team"]) {
        if (classification[field]) seen[field].add(classification[field]);
      }
    }

    for (const field of ["category", "subcategory", "team"]) {
      for (const value of seen[field]) {
        counts[field].set(value, (counts[field].get(value) ?? 0) + 1);
      }
    }
  }

  return counts;
}

/*
Returns a map for each cateogry, sub category and team with total fans like: 

{
  category: Map(3) {
    'sport' => 2,
    'film / tv' => 2,
    'influencer / content creator' => 2
  },
  subcategory: Map(3) { 'football' => 2, 'sci-fi' => 2, 'wrestling' => 2 },
  team: Map(5) {
    'Newcastle United' => 2,
    'Arsenal' => 2,
    'Manchester United' => 2,
    'Barcelona' => 2,
    'Chelsea' => 2
  }
} */

// calculate what percentage of each category, sub cateogry and team is followed by each fan

function toShares(countMap, totalFans) {
  return [...countMap]
    .map(([name, fans]) => ({ name, fans, share: fans / totalFans }))
    .sort((a, b) => b.fans - a.fans);
}

// Individual accounts with their classification organised by most -> least folllowed
function topAccounts(accounts) {
  return (
    accounts
      // Only name accounts that are verified or that the model recognised. An
      // unverified "unknown" account could be a private individual, so it still
      // counts towards the category totals but isn't listed by name
      .filter(
        (account) =>
          account.is_verified || account.classification.category !== "unknown",
      )
      .map((account) => ({
        username: account.username,
        full_name: account.full_name,
        fans: account.fans,
        share: account.share,
        category: account.classification.category,
        subcategory: account.classification.subcategory,
        team: account.classification.team,
      }))
      .sort((a, b) => b.fans - a.fans)
  );
}

//categories followed organised most -> least
function topAccountsByCategory(accountRows, perCategory = 5) {
  const byCategory = {};
  for (const row of accountRows) {
    byCategory[row.category] ??= [];
    if (byCategory[row.category].length < perCategory)
      byCategory[row.category].push(row);
  }
  return byCategory;
}

// "ig-fans-2026-10-30T07-58-10-795Z.json" -> ISO date string
function dateFromStamp(stamp) {
  const iso = stamp
    .replace(".json", "")
    .replace(/T(\d+)-(\d+)-(\d+)-(\d+)Z$/, "T$1:$2:$3.$4Z");
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Stage 01 and 02 totals: how big and loyal the engaged audience is.
//  Worked out here from the newest ig-fans- file and stored as totals only.
// (the ig-fans- file holds actual usernames so it never leaves this
// machine and maybe should get deleted at the end of the process?)

function getEngagementStats() {
  const fansFile = fs
    .readdirSync(FAN_ANALYSIS_DIR)
    .filter((file) => file.startsWith("ig-fans-") && file.endsWith(".json"))
    .sort()
    .at(-1);
  if (!fansFile) return null;

  const fans = readJson(fansFile);

  // Get the raw scrape with the matching timestamp which says which posts were analysed
  const rawFile = fansFile.replace("ig-fans-", "ig-engagement-raw-");
  const posts = fs.existsSync(path.join(FAN_ANALYSIS_DIR, rawFile))
    ? readJson(rawFile).posts.filter((post) => !post.error)
    : [];

  const postCount =
    posts.length || Math.max(0, ...fans.map((fan) => fan.postsEngaged));
  const postDates = posts
    .map((post) => post.timestamp)
    .filter(Boolean)
    .sort();

  return {
    scrapedAt: dateFromStamp(fansFile.replace("ig-fans-", "")),
    postCount,
    firstPostDate: postDates[0] ?? null,
    lastPostDate: postDates.at(-1) ?? null,
    totalFans: fans.length,
    privateFans: fans.filter((fan) => fan.is_private).length,
    commenters: fans.filter((fan) => fan.postsCommented.length > 0).length,
    repeatFans: fans.filter((fan) => fan.postsEngaged >= 2).length,
    superfans: fans.filter((fan) => fan.postsEngaged === postCount).length,
    eligibleFans: fans.filter(
      (fan) => !fan.is_private && !fan.is_verified && fan.postsEngaged >= 2,
    ).length,
  };
}
//Save results to supabase table
async function saveToSupabase(stamp, summary, engagement) {
  const { error } = await supabase.from("fan_analysis").upsert(
    {
      artist: ARTIST,
      platform: PLATFORM,
      source_stamp: stamp.replace(".json", ""),
      fans_analysed: summary.fansAnalysed,
      accounts_categorised: summary.accountsCategorised,
      engagement,
      summary,
    },
    { onConflict: "artist,platform,source_stamp" },
  );
  if (error) throw new Error(`Failed to save to Supabase: ${error.message}`);
}

async function main() {
  const { stamp, accounts, fans } = loadInputs();
  const lookup = buildClassificationLookup(accounts);
  const counts = countFans(fans, lookup);
  const accountRows = topAccounts(accounts);

  console.log(
    "shares for main cateogories ",
    toShares(counts.category, fans.length),
  );

  const summary = {
    fansAnalysed: fans.length,
    accountsCategorised: accounts.length,
    categories: toShares(counts.category, fans.length),
    subcategories: toShares(counts.subcategory, fans.length),
    teams: toShares(counts.team, fans.length),
    accounts: accountRows,
    accountsByCategory: topAccountsByCategory(accountRows),
  };

  const summaryPath = path.join(FAN_ANALYSIS_DIR, `ig-summary-${stamp}`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  // print summary.categories / subcategories / teams with console.table
  function printTable(title, rows) {
    console.log(`\n${title}`);
    console.table(
      rows.map(({ name, fans, share }) => ({
        name,
        fans,
        share: `${Math.round(share * 100)}%`,
      })),
    );
  }

  printTable("Categories", summary.categories);
  printTable("Subcategories", summary.subcategories);
  printTable("Teams", summary.teams);
  console.log(`Saved to ${summaryPath}`);

  const engagement = getEngagementStats();
  await saveToSupabase(stamp, summary, engagement);
  console.log(
    `Saved to Supabase (fan_analysis, ${ARTIST} / ${stamp.replace(".json", "")})`,
  );
}

main().catch((err) => {
  console.error("06_summarise.js failed:", err.message);
  process.exit(1);
});
