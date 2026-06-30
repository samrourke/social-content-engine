import OpenAI from "openai";
import fs from "fs/promises";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function selectClips() {
  const TRANSCRIPTS_DIR = "output/transcripts";
  const METADATA_DIR = "output/metadata";
  const CLIP_ANALYSIS_DIR = "output/clip-analysis";

  const clipAnalysisSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      sourceTitle: { type: "string" },
      overallClipPotential: { type: "number" },
      overallReason: { type: "string" },
      clips: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            topic: { type: "string" },
            format: {
              type: "string",
              enum: [
                "confession",
                "funny-story",
                "surprising-detail",
                "behind-the-scenes",
                "emotional-moment",
                "strong-opinion",
                "career-insight",
                "fan-interest",
                "other",
              ],
            },
            viralScore: { type: "number" },
            startSnippet: { type: "string" },
            endSnippet: { type: "string" },
            hook: { type: "string" },
            hookReason: { type: "string" },
            reasonToWatch: { type: "string" },
            payoff: { type: "string" },
            takeaway: { type: "string" },
            onScreenText: { type: "string" },
            captionIdea: { type: "string" },
            estimatedDuration: { type: "number" },
            requiresContext: { type: "boolean" },
            confidence: { type: "number" },
          },
          required: [
            "title",
            "topic",
            "format",
            "viralScore",
            "startSnippet",
            "endSnippet",
            "hook",
            "hookReason",
            "reasonToWatch",
            "payoff",
            "takeaway",
            "onScreenText",
            "captionIdea",
            "estimatedDuration",
            "requiresContext",
            "confidence",
          ],
        },
      },
    },
    required: ["sourceTitle", "overallClipPotential", "overallReason", "clips"],
  };

  async function getJsonFiles(directory) {
    try {
      const files = await fs.readdir(directory);
      return files.filter((file) => file.endsWith(".json"));
    } catch {
      return [];
    }
  }

  async function processClips({ transcriptText, metadata }) {
    const response = await openai.responses.parse({
      model: "gpt-5.5",

      input: [
        {
          role: "system",
          content: `
You are an expert short-form video editor and social media strategist.

You analyse music-related interview transcripts and identify only the strongest TikTok / Reels / Shorts candidates.

The metadata is provided for context.
The transcript is the source of truth.

Your task:
Find continuous sections of the transcript that could become engaging short-form video clips.

Do not return ordinary interview answers.
Do not return clips just because they are informative.
Only return clips with genuine short-form potential.

A good clip should have:
- a hook within the first 3 seconds
- a clear reason to keep watching
- a payoff, punchline, reveal, emotional turn or useful insight
- minimal dependency on earlier context
- a natural beginning and ending
- a self-contained idea

Reject clips if:
- they need too much setup
- they only make sense in the full interview
- they trail off without a payoff
- they are mainly promotional
- they are repetitive
- they are too vague
- the start or end point is unclear

Clip boundaries:
- Each clip must be one continuous section of the transcript.
- startSnippet must be copied verbatim from the transcript.
- endSnippet must be copied verbatim from the transcript.
- startSnippet should be a distinctive 4–8 word phrase near the beginning of the clip.
- endSnippet should be a distinctive 4–10 word phrase near the natural end of the clip.
- endSnippet must occur after startSnippet.
- Do not combine separate moments.

Scoring:
viralScore is 0–100.
Only include clips with a viralScore of 70 or higher.
If there are no strong candidates, return an empty clips array.

Estimate duration in seconds.

For onScreenText:
Write a short text overlay that would make someone stop scrolling.
Do not use clickbait that misrepresents the clip.

For captionIdea:
Write a natural TikTok/Reels caption.

For hook:
Summarise the opening hook of the clip.

For payoff:
Explain what the viewer gets by watching to the end.

For requiresContext:
true means the clip probably needs setup outside the clip.
false means it works by itself.
        `,
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              metadata,
              transcript: transcriptText,
            },
            null,
            2,
          ),
        },
      ],

      text: {
        format: {
          type: "json_schema",
          name: "clip_analysis",
          schema: clipAnalysisSchema,
        },
      },
    });

    return response.output_parsed;
  }

  async function processClipSelection() {
    await fs.mkdir(CLIP_ANALYSIS_DIR, { recursive: true });

    const transcriptFiles = await getJsonFiles(TRANSCRIPTS_DIR);
    const existingClipAnalysisFiles = await getJsonFiles(CLIP_ANALYSIS_DIR);

    const existingClipAnalysis = new Set(
      existingClipAnalysisFiles.map((file) => path.parse(file).name),
    );

    const pendingFiles = transcriptFiles.filter((file) => {
      const stem = path.parse(file).name;
      return !existingClipAnalysis.has(stem);
    });

    if (pendingFiles.length === 0) {
      console.log("No new transcript files found for clip analysis.");
      return;
    }

    console.log(
      `Clip selection started. Files to process: ${pendingFiles.length}`,
    );

    for (const [index, file] of pendingFiles.entries()) {
      const stem = path.parse(file).name;

      const transcriptPath = path.join(TRANSCRIPTS_DIR, file);
      const metadataPath = path.join(METADATA_DIR, `${stem}.json`);
      const outputPath = path.join(CLIP_ANALYSIS_DIR, `${stem}.json`);

      try {
        const transcriptJson = JSON.parse(
          await fs.readFile(transcriptPath, "utf8"),
        );
        const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));

        if (!transcriptJson.text || typeof transcriptJson.text !== "string") {
          console.warn(`[Skipped] ${file} has no valid transcript text.`);
          continue;
        }

        const analysis = await processClips({
          transcriptText: transcriptJson.text,
          metadata,
        });

        await fs.writeFile(outputPath, JSON.stringify(analysis, null, 2));

        console.log(
          `[Clip Selection] (${index + 1}/${pendingFiles.length}) ${file} analysed successfully.`,
        );
      } catch (error) {
        console.error(`[Error] Failed to analyse clips for ${file}`);
        console.error(error);
      }
    }

    console.log("Clip selection complete.");
  }

  await processClipSelection();
}
