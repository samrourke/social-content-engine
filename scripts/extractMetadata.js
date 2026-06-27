import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/*Create array of transcriptions */
const transcripts = fs
  .readdirSync("output/transcripts")
  .filter((file) => file.endsWith(".txt"));

/*Create array of existing metadata objects */

const metadataObjects = fs
  .readdirSync("output/metadata")
  .filter((file) => file.endsWith(".json"));

/*if no transcriptions exit */

if (transcripts.length === 0) {
  console.log("No transcript files found in /output/transcripts");
  process.exit(0);
}

/*create array of strings matching existing metadata file names */
const existingMetadata = metadataObjects.map((file) => path.parse(file).name);

/*filter transcriptions array to remove any transcripts that
already match a json file*/

const pendingTranscripts = transcripts.filter((file) => {
  const stem = path.parse(file).name;
  return !existingMetadata.includes(stem);
});

/*if no new transcripts found - exit */

if (pendingTranscripts.length === 0) {
  console.log("No NEW transcript files found in /output/transcripts");
  process.exit(0);
}

const metadataSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    title: {
      type: "string",
    },

    clipPotential: {
      type: "number",
    },

    clipPotentialReason: {
      type: "string",
    },

    summary: {
      type: "string",
    },

    searchDescription: {
      type: "string",
    },

    videoType: {
      type: "string",
    },

    tone: {
      type: "array",
      items: {
        type: "string",
      },
    },

    places: {
      type: "array",
      items: {
        type: "string",
      },
    },

    topics: {
      type: "array",
      items: {
        type: "string",
      },
    },

    keywords: {
      type: "array",
      items: {
        type: "string",
      },
    },

    people: {
      type: "array",
      items: {
        type: "string",
      },
    },

    entities: {
      type: "array",
      items: {
        type: "string",
      },
    },

    contentSignals: {
      type: "array",
      items: {
        type: "string",
      },
    },

    tags: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },

  required: [
    "title",
    "summary",
    "clipPotential",
    "clipPotentialReason",
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

async function extractMetadata(transcript) {
  const response = await openai.responses.parse({
    model: "gpt-5-mini",

    input: [
      {
        role: "system",
        content: `
You analyse transcripts from a large library of music-related videos.

Your job is to produce structured metadata that will later be used for:

- semantic search
- categorisation
- recommendation
- clip discovery

Return ONLY information that can be inferred from the transcript.

Do not speculate or invent facts.

If a field cannot be determined, return an empty string or empty array.

Video Type must be exactly ONE of:

- Interview
- Live Performance
- Festival
- Music Video
- Behind the Scenes
- Studio Session
- Documentary


Return:

• title
A concise descriptive title.

• summary
2–3 sentence overview of the transcript.

• clipPotential

Return a decimal number between 0.0 and 10.0 with exactly one decimal place  indicating how suitable this video is for creating engaging short-form social media clips.

Examples:
3.2
6.7
8.4
9.9


Consider factors such as:

- Number of memorable moments
- Strength of personal stories
- Emotional impact
- Humour
- Controversial or surprising opinions
- Actionable advice
- Quotable statements
- Audience appeal
- Variety of interesting topics

A higher score should indicate that the transcript contains many strong, self-contained moments that are likely to work well as short clips.

Examples:

0–2   Mostly repetitive, little value for clipping.
3–5   Some interesting discussion but few standout moments.
6–8   Multiple good clip opportunities.
9–10  Exceptionally clip-rich with numerous memorable, engaging moments.

• clipPotentialReason
Your reasoning behind the clipPotential score, 1-2 sentences to justify why you gave this video file
the score you did

• searchDescription
A natural language description written specifically for semantic search.

• videoType
Choose exactly one value from the list above.

• tone
2–5 words describing the emotional tone.
Examples:
["humorous", "reflective", "optimistic"]

• places
Any places, cities, countries or venues mentioned.

• topics
3–6 high-level discussion topics.

• keywords
5–10 important keywords or phrases.

• people
Full names of people whenever known.
If only a first name is given, use that.
For reference the band members are:
- "Kieran Shudall" Lead singer, guitarist and songwirter
- "Sam Rourke" Bass player 
- "Joe Falconer" Lead guitarist
- "Colin Jones" drummer

• entities
Bands, companies, radio stations, labels, albums, songs, festivals, venues or organisations that are mentioned.

• contentSignals
3–8 recurring themes or content types that would help identify interesting clips.

Examples:
- personal story
- career advice
- songwriting
- fatherhood
- mental health
- humour
- audience interaction
- touring
- recording process

• tags
5–10 broad searchable tags.
Avoid simply repeating the keywords.
`,
      },

      {
        role: "user",
        content: transcript,
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
  const batchSize = pendingTranscripts.length;

  for (const [index, file] of pendingTranscripts.entries()) {
    const inputFile = path.join("output/transcripts", file);
    const outputName = path.parse(file).name;
    const outputFile = path.join("output/metadata", `${outputName}.json`);

    try {
      const transcript = fs.readFileSync(inputFile, "utf8");

      const metadata = await extractMetadata(transcript);

      fs.writeFileSync(outputFile, JSON.stringify(metadata, null, 2));
      console.log(
        `[Metadata] (${index + 1}/${batchSize}) ${inputFile} data successfully extracted`,
      );
    } catch (error) {
      console.error(error);
    }
  }
}

processTranscriptFiles();
