import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: openaiApiKey });

//music artist, venue/festival,
// music media, brand/fashion,
// sport, film/TV, comedy/creator, food/drink
const ACCOUNT_PILLARS = [
  "music artist",
  "venue/festival",
  "music media",
  "influencer / content creator",
  "fashion brand",
  "sport / sport personality",
  "comedian",
  "food/drink",
];

const SENSITIVE_PILLARS = [
  "religious groups",
  "gender or sexuality groups",
  "political parties",
  "medical and health issue groups",
];

const pillarSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    contentPillar: {
      type: "string",
      enum: ACCOUNT_PILLARS,
    },
  },
  required: ["contentPillar"],
};

async function classifyPage(page, id, fullName) {
  const response = await openai.responses.parse({
    model: "gpt-5-mini",

    input: [
      {
        role: "system",
        content: `
You classify instagram profile pages based from the username and user id and full name

Choose exactly one from the following categories:

    - music artist - a musician, band or musical artist
    - venue/festival - a music venue or music festival 
    - music media - any music magazine or online music publication
    - influencer / content creator - any content creator, blogger, influencer of any kind
    - fashion brand - any brand relating to clothing, hair or make up
    - actor - a tv or film star
    - sport / sport personality - any sports related account
    - comedian - a comedy personalty
    - food/drink - any food or drink related page

If the profile fits into one of the following categories: 
    - religious groups 
    - gender or sexuality groups,
    - political parties,
    - medical and health issue groups,

    Then discount it from the results.

    If a profile does not fit into any of the above categories then return 'unknown'

    



        `,
      },
      {
        role: "user",
        content: page,
        id,
        fullName,
      },
    ],

    text: {
      format: {
        type: "json_schema",
        name: "account_pillar",
        schema: pillarSchema,
      },
    },
  });

  return response.output_parsed.contentPillar;
}

async function categoriseSharedResults() {
  const INSTA_ENGAGEMENT_DIR = "output/fan-analysis";

  const ANALYSIS_FILES = fs
    .readdirSync(INSTA_ENGAGEMENT_DIR)
    .filter((file) => file.startsWith("ig-following-"))
    .filter((file) => file.endsWith(".json"));

  if (ANALYSIS_FILES.length === 0) {
    console.log("No following list files found in /output/fan-analysis.");
    return;
  }

  const latestFile = ANALYSIS_FILES.sort().at(-1);

  const raw = JSON.parse(
    fs.readFileSync(path.join(INSTA_ENGAGEMENT_DIR, latestFile), "utf8"),
  );

  console.log(latestFile);

  if (!openaiApiKey) {
    throw new Error("Missing OPENAI_API_KEY or Supabase credentials.");
  }

  for (const profile of raw) {
    try {
      const contentPillar = await classifyPage(
        profile.username,
        profile.id,
        profile.full_name,
      );
      raw.contentPillar = contentPillar;

      console.log("tagged ", profile.username);
    } catch (err) {
      console.error(`[Error] Failed to tag`, profile.username);
    }
  }
}

categoriseSharedResults();
