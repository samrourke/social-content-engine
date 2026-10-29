import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env" });

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: openaiApiKey });

if (!openaiApiKey) {
  throw new Error("Missing OPENAI_API_KEY or Supabase credentials.");
}

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
async function classifyPage(account) {
  const response = await openai.responses.parse({
    model: "gpt-5-mini",

    input: [
      {
        role: "system",
        content: `
You classify Instagram accounts from their username, full name and verified status.

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
        content: `Username: @${account.username}\nFull name: ${account.full_name}\nVerified: ${account.is_verified}`,
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

async function categoriseSharedResults() {
  const INSTA_ENGAGEMENT_DIR = "output/fan-analysis";

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

  const raw = JSON.parse(
    fs.readFileSync(path.join(INSTA_ENGAGEMENT_DIR, latestFile), "utf8"),
  );

  const taggedProfiles = [];

  let sensitiveCount = 0;
  let failedCount = 0;

  for (const profile of raw) {
    try {
      const classificationResult = await classifyPage(profile);

      if (classificationResult.sensitive) {
        sensitiveCount += 1;
        continue;
      }

      taggedProfiles.push({ ...profile, classification: classificationResult });
    } catch (err) {
      failedCount += 1;
      console.error(
        `[Error] Failed to tag ${profile.username}: ${err.message}`,
      );
    }
  }

  // for (const profile of raw) {
  //   try {
  //     const classificationResult = await classifyPage(profile);

  //     const categorisedProfile = {
  //       ...profile,
  //       classification: classificationResult,
  //     };
  //     if (!classificationResult.sensitive) {
  //       taggedProfiles.push(categorisedProfile);
  //     }

  //     console.log(
  //       "content pillar for ",
  //       profile.username,
  //       "is, ",
  //       classificationResult,
  //     );
  //   } catch (err) {
  //     console.error(`[Error] Failed to tag`, profile.username, "Error: ", err);
  //   }
  // }

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

categoriseSharedResults();
