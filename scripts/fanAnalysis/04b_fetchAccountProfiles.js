import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { ApifyClient } from "apify-client";

dotenv.config({ path: ".env" });

const FAN_ANALYSIS_DIR = "output/fan-analysis";

const OUTPUT_DIR = "output/fan-analysis";

const COST_PER_PROFILE = 0.0023;

// Set to a small number to test field names cheaply; null for the full list
const TEST_LIMIT = null;

const apifyToken = process.env.APIFY_API_TOKEN;
if (!apifyToken) throw new Error("Missing APIFY_API_TOKEN.");

const apify = new ApifyClient({ token: apifyToken });
const ACTOR_ID = "apify/instagram-profile-scraper";

console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");
console.log(
  `Fetching Account Profiles for accounts of interest followed by multiple fans of ${process.env.INSTAGRAM_USERNAME ?? "circawaves"}...`,
);
console.log("Today's Date: " + new Date().toString());
console.log("<<<<<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>");
console.log("");
console.log("");

//Generic Apify helper function

async function runActor(actorId, input, options) {
  const run = await apify.actor(actorId).call(input, options);
  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items;
}

const inputFile = fs
  .readdirSync(FAN_ANALYSIS_DIR)
  .filter(
    (file) => file.startsWith("ig-shared-accounts-") && file.endsWith(".json"),
  )
  .sort()
  .at(-1);

if (!inputFile) {
  throw new Error("No shared accounts file! Run 04_analyse.js first");
}

const accounts = JSON.parse(
  fs.readFileSync(path.join(FAN_ANALYSIS_DIR, inputFile), "utf8"),
);

const accountsToFetch = TEST_LIMIT ? accounts.slice(0, TEST_LIMIT) : accounts;

const profileUsernames = accountsToFetch.map((account) => account.username);

const outputPath = path.join(
  FAN_ANALYSIS_DIR,
  inputFile.replace("ig-shared-accounts-", "ig-account-profiles-"),
);

if (fs.existsSync(outputPath)) {
  throw new Error(
    "Account profiles already fetched from this data, see output/fan-analysis folder",
  );
}

function slimProfile(profile) {
  return {
    username: profile.username,
    followers: profile.followersCount ?? null,
    biography: profile.biography ?? null,
    business_category: profile.businessCategoryName ?? null,
    is_business: profile.isBusinessAccount ?? null,
    related_profiles: (profile.relatedProfiles ?? []).map((related) => ({
      id: related.id,
      username: related.username,
      full_name: related.full_name,
      is_verified: related.is_verified,
    })),
  };
}

async function main() {
  console.log(
    `Cost of scape = $${(COST_PER_PROFILE * accountsToFetch.length).toFixed(2)}`,
  );

  const profiles = await runActor(
    ACTOR_ID,
    {
      usernames: profileUsernames,
      includeAboutSection: false,
    },
    { maxItems: accountsToFetch.length },
  );

  const profilesByUsername = new Map(
    profiles.map((profile) => [profile.username?.toLowerCase(), profile]),
  );

  const results = {};
  const missing = [];
  const mismatched = [];

  for (const account of accountsToFetch) {
    const profile = profilesByUsername.get(account.username.toLowerCase());

    if (!profile) {
      missing.push(account.username);
    } else if (String(profile.id) !== account.id) {
      // Username now belongs to a different account
      mismatched.push(account.username);
    } else {
      results[account.id] = slimProfile(profile);
    }
  }

  console.log("Sample raw profile fields:", Object.keys(profiles[0] ?? {}));
  console.log(
    "Sample id:",
    profiles[0]?.id,
    typeof profiles[0]?.id,
    "| followersCount:",
    profiles[0]?.followersCount,
  );

  console.log("<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>");
  console.log("<<<<<<<<<<<<<<<<>>>>>>>>>>>>>>>>>>>>>");

  console.log("Account Profile Fetch Summary");
  console.log(`${mismatched.length} accounts with mismatched ID and username`);
  console.log(`${missing.length} accounts missing`);
  console.log(
    `${Object.keys(results).length} of ${accountsToFetch.length} accounts profiled`,
  );

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        scrapedAt: new Date().toISOString(),
        sourceFile: inputFile,
        profiles: results,
        missing,
        mismatched,
      },
      null,
      2,
    ),
  );
  console.log(`Saved to ${outputPath}`);
}

main().catch((err) => {
  console.error("04b_fetchAccountProfiles.js failed:", err.message);
  process.exit(1);
});
