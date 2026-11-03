// scripts/fanAnalysis/05_categoriseSharedAccounts.js
//
// Stage 5 of the fan analysis: asks OpenAI to categorise each account that
// several fans follow (from 04), e.g. "music artist / indie / alternative".
// Sensitive accounts (religion, politics, sexuality, health) are dropped here,
// so they never reach a total.
//
// Uses the matching ig-account-profiles file from 04b when there is one, so the
// model sees each account's bio, business category and follower count as well
// as its name — far fewer "unknown"s for smaller accounts it doesn't recognise.
//
// Run with:
//   node scripts/fanAnalysis/05_categoriseSharedAccounts.js
//
// Required env vars (already in .env):
//   OPENAI_API_KEY=

import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env" });

const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  throw new Error("Missing OPENAI_API_KEY.");
}
const openai = new OpenAI({ apiKey: openaiApiKey });

//TODO: make per-client folder for analysis files!
const FAN_ANALYSIS_DIR = "output/fan-analysis";
// How many accounts to categorise at once. Each request is independent, so
// running several together cuts ~500 accounts from ~25 minutes to ~3
const CONCURRENCY = 8;
// Bios can be long; the first few hundred characters are plenty to categorise
const MAX_BIO_LENGTH = 300;

//music artist, venue/festival,
// music media, brand/fashion,
// sport, film/TV, comedy/creator, food/drink
const CATEGORY_DESCRIPTIONS = {
  "music artist": "a musician, band or musical artist",
  "venue/festival": "a music venue or music festival",
  "music media": "a music magazine, radio station or online music publication",
  "influencer / content creator": "a content creator, blogger or influencer",
  "fashion / beauty brand": "a clothing, hair or make-up brand",
  actor: "a film or television actor",
  "film / tv": "a film, TV show, franchise, studio or channel",
  sport: "an athlete, team, league or sports account",
  comedian: "a comedian or comedy account",
  "food/drink": "a food or drink brand, restaurant or bar",
  unknown:
    "you don't recognise the account and the name doesn't make the category clear",
};

// Subcategories, so results can be counted at a finer level
const SPORTS = [
  "football",
  "basketball",
  "american football",
  "tennis",
  "golf",
  "boxing",
  "mma",
  "wrestling",
  "f1 / motorsport",
  "cricket",
  "rugby",
  "cycling",
  "athletics",
  "other sport",
];

const SCREEN_GENRES = [
  "sci-fi",
  "fantasy",
  "action",
  "comedy",
  "drama",
  "crime / thriller",
  "horror",
  "animation",
  "documentary",
  "reality tv",
  "other genre",
];

const MUSIC_GENRES = [
  "indie / alternative",
  "rock",
  "pop",
  "hip hop / rap",
  "electronic / dance",
  "punk / emo",
  "metal",
  "folk / singer-songwriter",
  "r&b / soul",
  "other genre",
];

const ACCOUNT_CATEGORIES = Object.keys(CATEGORY_DESCRIPTIONS);
const SUBCATEGORIES = [
  ...new Set([...SPORTS, ...SCREEN_GENRES, ...MUSIC_GENRES]),
];

const categorySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: ACCOUNT_CATEGORIES },
    subcategory: { type: ["string", "null"], enum: [...SUBCATEGORIES, null] },
    team: { type: ["string", "null"] },
    sensitive: { type: "boolean" },
  },
  required: ["category", "subcategory", "team", "sensitive"],
};
// The text the model sees for one account
function describeAccount(account, profile) {
  const lines = [
    `Username: @${account.username}`,
    `Full name: ${account.full_name || "(none)"}`,
    `Verified: ${account.is_verified}`,
  ];
  if (profile) {
    if (profile.followers != null)
      lines.push(`Followers: ${profile.followers}`);
    if (profile.business_category)
      lines.push(`Business category: ${profile.business_category}`);
    if (profile.biography) {
      lines.push(
        `Bio: ${profile.biography.slice(0, MAX_BIO_LENGTH).replace(/\s+/g, " ")}`,
      );
    }
  }
  return lines.join("\n");
}

async function classifyPage(account, profile) {
  const response = await openai.responses.parse({
    model: "gpt-5-mini",

    input: [
      {
        role: "system",
        content: `
You classify Instagram accounts from their username, full name, verified status
and, when given, their bio, Instagram business category and follower count.
The bio and business category are usually the best evidence for smaller accounts
you don't recognise (e.g. a business category of "Musician/band").

Choose exactly one category:
${Object.entries(CATEGORY_DESCRIPTIONS)
  .map(([name, description]) => `- ${name}: ${description}`)
  .join("\n")}

  For sport accounts, set subcategory to the sport (${SPORTS.join(", ")}), and team to
the team they play for or are, using its common short name (e.g. "Chelsea"). 

team is null for individual sports such as but not limited to golf, wrestling, athletics etc and also for leagues or organisations

For actors and film / tv accounts, set subcategory to the genre they are best known for
(${SCREEN_GENRES.join(", ")}).
For music artists, music media and venues/festivals, set subcategory to the main genre
(${MUSIC_GENRES.join(", ")}).
For everything else, subcategory is null.

Set sensitive to true if the account is mainly about religion, politics or political
campaigns, sexuality or gender identity, or health and medical conditions. Otherwise false.

If you don't recognise the account and the name doesn't make the category clear,
don't guess: return "unknown".
`,
      },
      {
        role: "user",
        content: describeAccount(account, profile),
      },
    ],

    text: {
      format: {
        type: "json_schema",
        name: "account_category",
        schema: categorySchema,
      },
    },
  });

  return response.output_parsed;
}

// The 04b profiles for the same run, keyed by account id, or null if 04b
// hasn't been run (categorising then falls back to names only)
function loadProfiles(sharedFile) {
  const profilesFile = sharedFile.replace(
    "ig-shared-accounts-",
    "ig-account-profiles-",
  );
  const profilesPath = path.join(FAN_ANALYSIS_DIR, profilesFile);
  if (!fs.existsSync(profilesPath)) {
    console.warn(
      `No ${profilesFile} — categorising from names only. Run 04b first for better results.`,
    );
    return null;
  }
  console.log(`Using profiles from ${profilesFile}`);
  return JSON.parse(fs.readFileSync(profilesPath, "utf8")).profiles;
}

// Runs worker(item) for every item, at most `limit` at a time, keeping results
// in the same order as items
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  async function runNext() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runNext),
  );
  return results;
}

async function categoriseSharedResults() {
  const INSTA_ENGAGEMENT_DIR = FAN_ANALYSIS_DIR;

  const ANALYSIS_FILES = fs
    .readdirSync(INSTA_ENGAGEMENT_DIR)
    .filter((file) => file.startsWith("ig-shared-accounts-"))
    .filter((file) => file.endsWith(".json"));

  if (ANALYSIS_FILES.length === 0) {
    console.log(
      "No ig-shared-accounts list files found in /output/fan-analysis.",
    );
    return;
  }

  const latestFile = ANALYSIS_FILES.sort().at(-1);
  console.log(`Categorising ${latestFile}`);

  const raw = JSON.parse(
    fs.readFileSync(path.join(INSTA_ENGAGEMENT_DIR, latestFile), "utf8"),
  );
  const profiles = loadProfiles(latestFile);

  let done = 0;
  const outcomes = await mapWithConcurrency(
    raw,
    CONCURRENCY,
    async (account) => {
      try {
        const classification = await classifyPage(
          account,
          profiles?.[account.id],
        );
        return { account, classification };
      } catch (err) {
        console.error(
          `[Error] Failed to tag ${account.username}: ${err.message}`,
        );
        return { account, error: err.message };
      } finally {
        done += 1;
        if (done % 50 === 0 || done === raw.length) {
          console.log(`  ${done}/${raw.length} categorised`);
        }
      }
    },
  );

  const failedCount = outcomes.filter((outcome) => outcome.error).length;
  const sensitiveCount = outcomes.filter(
    (outcome) => outcome.classification?.sensitive,
  ).length;
  const taggedProfiles = outcomes
    .filter(
      (outcome) => outcome.classification && !outcome.classification.sensitive,
    )
    .map(({ account, classification }) => ({ ...account, classification }));

  const categorisationPath = path.join(
    INSTA_ENGAGEMENT_DIR,
    latestFile.replace("ig-shared-accounts-", "ig-accounts-categorised-"),
  );

  if (categorisationPath === path.join(INSTA_ENGAGEMENT_DIR, latestFile)) {
    throw new Error(
      "Output path is the same as the input — refusing to overwrite.",
    );
  }

  fs.writeFileSync(categorisationPath, JSON.stringify(taggedProfiles, null, 2));

  console.log(`Saved to ${categorisationPath}`);

  const categoryCounts = {};
  for (const profile of taggedProfiles) {
    const { category } = profile.classification;
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
  }

  console.log(`Categorised ${taggedProfiles.length} of ${raw.length} accounts`);
  console.log(`  removed as sensitive: ${sensitiveCount}`);
  console.log(`  failed: ${failedCount}`);
  console.table(categoryCounts);
}

categoriseSharedResults().catch((err) => {
  console.error("05_categoriseSharedAccounts.js failed:", err.message);
  process.exit(1);
});
