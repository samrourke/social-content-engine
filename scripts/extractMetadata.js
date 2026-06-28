import OpenAI from "openai";
import fs from "fs/promises";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TRANSCRIPTS_DIR = "output/transcripts";
const METADATA_DIR = "output/metadata";

const metadataSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    searchDescription: { type: "string" },
    videoType: {
      type: "string",
      enum: [
        "Interview",
        "Live Performance",
        "Festival",
        "Music Video",
        "Behind the Scenes",
        "Studio Session",
        "Documentary",
        "Unknown",
      ],
    },
    tone: {
      type: "array",
      items: { type: "string" },
    },
    places: {
      type: "array",
      items: { type: "string" },
    },
    topics: {
      type: "array",
      items: { type: "string" },
    },
    keywords: {
      type: "array",
      items: { type: "string" },
    },
    people: {
      type: "array",
      items: { type: "string" },
    },
    entities: {
      type: "array",
      items: { type: "string" },
    },
    contentSignals: {
      type: "array",
      items: { type: "string" },
    },
    tags: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "title",
    "summary",
    "searchDescription",
    "videoType",
    "tone",
    "places",
    "topics",
    "keywords",
    "people",
    "entities",
    "contentSignals",
    "tags",
  ],
};

async function getJsonFiles(directory) {
  try {
    const files = await fs.readdir(directory);
    return files.filter((file) => file.endsWith(".json"));
  } catch {
    return [];
  }
}

async function extractMetadata(transcriptText) {
  const response = await openai.responses.parse({
    model: "gpt-5-mini",

    input: [
      {
        role: "system",
        content: `
You analyse transcripts from a music-related video archive.

Your task is to extract factual metadata only.

This metadata will be used for:
- semantic search
- categorisation
- filtering
- recommendation
- later clip selection

Do NOT identify TikTok clips.
Do NOT score viral potential.
Do NOT suggest edits.
Do NOT invent facts.
Only return information that can be inferred from the transcript.

If a field cannot be determined, return an empty string or empty array.

videoType must be exactly one of:
- Interview
- Live Performance
- Festival
- Music Video
- Behind the Scenes
- Studio Session
- Documentary
- Unknown

Field instructions:

title:
A concise descriptive title for the full video.

summary:
A factual 2–3 sentence overview of the transcript.

searchDescription:
A natural language description optimised for semantic search. Include the main people, artists, songs, albums, themes, locations and discussion areas where available.

videoType:
Choose the best matching category.

tone:
2–5 emotional or stylistic tone words.
Examples: ["reflective", "humorous", "candid"]

places:
Any places, cities, countries, venues or locations mentioned.

topics:
3–8 high-level topics discussed.

keywords:
5–12 important searchable keywords or phrases.

people:
Names of people mentioned. Use full names where known. If only a first name appears, use that.

entities:
Bands, artists, companies, radio stations, labels, albums, songs, festivals, venues, organisations or media outlets mentioned.

contentSignals:
Recurring content patterns that may later help another script find clips.
Examples:
- personal story
- songwriting
- touring
- album discussion
- live performance
- fan interaction
- humour
- health
- career reflection
- behind the scenes

tags:
5–12 broad searchable tags. Avoid simply duplicating keywords.
        `,
      },
      {
        role: "user",
        content: transcriptText,
      },
    ],

    text: {
      format: {
        type: "json_schema",
        name: "metadata",
        schema: metadataSchema,
      },
    },
  });

  return response.output_parsed;
}

async function processTranscriptFiles() {
  await fs.mkdir(METADATA_DIR, { recursive: true });

  const transcripts = await getJsonFiles(TRANSCRIPTS_DIR);
  const metadataFiles = await getJsonFiles(METADATA_DIR);

  if (transcripts.length === 0) {
    console.log("No transcript files found in /output/transcripts");
    process.exit(0);
  }

  const existingMetadata = new Set(
    metadataFiles.map((file) => path.parse(file).name),
  );

  const pendingTranscripts = transcripts.filter((file) => {
    const stem = path.parse(file).name;
    return !existingMetadata.has(stem);
  });

  if (pendingTranscripts.length === 0) {
    console.log("No new transcript files found.");
    process.exit(0);
  }

  console.log(
    `Metadata extraction started. Files to process: ${pendingTranscripts.length}`,
  );

  for (const [index, file] of pendingTranscripts.entries()) {
    const inputFile = path.join(TRANSCRIPTS_DIR, file);
    const outputName = path.parse(file).name;
    const outputFile = path.join(METADATA_DIR, `${outputName}.json`);

    try {
      const transcriptJson = JSON.parse(await fs.readFile(inputFile, "utf8"));

      if (!transcriptJson.text || typeof transcriptJson.text !== "string") {
        console.warn(`[Skipped] ${file} has no valid transcript text.`);
        continue;
      }

      const metadata = await extractMetadata(transcriptJson.text);

      await fs.writeFile(outputFile, JSON.stringify(metadata, null, 2));

      console.log(
        `[Metadata] (${index + 1}/${pendingTranscripts.length}) ${file} processed successfully.`,
      );
    } catch (error) {
      console.error(`[Error] Failed to process ${file}`);
      console.error(error);
    }
  }

  console.log("Metadata extraction complete.");
}

processTranscriptFiles();
