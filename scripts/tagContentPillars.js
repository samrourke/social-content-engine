// scripts/tagContentPillars.js
//
// Classifies each TikTok video's caption into a content pillar and writes
// it back to tiktok_videos.content_pillar, so performance can be broken
// down by content type rather than surface stats like duration.
//
// Run with:
//   node scripts/tagContentPillars.js

import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });

const openaiApiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!openaiApiKey || !supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing OPENAI_API_KEY or Supabase credentials.");
}

const openai = new OpenAI({ apiKey: openaiApiKey });
const supabase = createClient(supabaseUrl, serviceRoleKey);

const CONTENT_PILLARS = [
  "promo",
  "behind-the-scenes",
  "humor-personal",
  "live-tour",
  "fan-interaction",
  "other",
];

const pillarSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    contentPillar: {
      type: "string",
      enum: CONTENT_PILLARS,
    },
  },
  required: ["contentPillar"],
};

async function classifyCaption(caption) {
  const response = await openai.responses.parse({
    model: "gpt-5-mini",

    input: [
      {
        role: "system",
        content: `
You classify TikTok captions from a band's account into a single content pillar.

Choose exactly one of:

- promo: announces or promotes a release, single, album, pre-order, merch or tour date.
- behind-the-scenes: shows the process behind making music/videos — studio, rehearsal, writing, filming.
- humor-personal: jokes, personal moments, relatable or POV bits with no promotional intent.
- live-tour: footage from a live show, tour stop, backstage-while-touring, or crowd/venue content.
- fan-interaction: directly replies to or addresses a fan comment or question.
- other: doesn't clearly fit any of the above, or the caption is empty/uninformative.

Base the decision only on the caption text provided.
        `,
      },
      {
        role: "user",
        content: caption && caption.trim() ? caption : "(no caption)",
      },
    ],

    text: {
      format: {
        type: "json_schema",
        name: "content_pillar",
        schema: pillarSchema,
      },
    },
  });

  return response.output_parsed.contentPillar;
}

async function tagContentPillars() {
  const { data: videos, error } = await supabase
    .from("tiktok_videos")
    .select("platform_video_id, caption")
    .is("content_pillar", null);

  if (error) throw new Error(`Failed to fetch videos: ${error.message}`);

  if (!videos || videos.length === 0) {
    console.log("No untagged videos found.");
    return;
  }

  console.log(`Tagging content pillars for ${videos.length} video(s).`);

  let tagged = 0;

  for (const [index, video] of videos.entries()) {
    try {
      const contentPillar = await classifyCaption(video.caption);

      const { error: updateError } = await supabase
        .from("tiktok_videos")
        .update({
          content_pillar: contentPillar,
          updated_at: new Date().toISOString(),
        })
        .eq("platform_video_id", video.platform_video_id);

      if (updateError) throw updateError;

      tagged += 1;

      console.log(
        `[Pillar] (${index + 1}/${videos.length}) ${video.platform_video_id} -> ${contentPillar}`,
      );
    } catch (err) {
      console.error(
        `[Error] Failed to tag ${video.platform_video_id}: ${err.message}`,
      );
    }
  }

  console.log("---");
  console.log(`Tagging complete. ${tagged}/${videos.length} videos tagged.`);
}

tagContentPillars().catch((err) => {
  console.error("tagContentPillars.js failed:", err.message);
  process.exit(1);
});
