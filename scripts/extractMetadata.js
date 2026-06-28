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
  .filter((file) => file.endsWith(".json"));

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
    title: { type: "string" },
    clipPotential: { type: "number" },
    clipPotentialReason: { type: "string" },
    summary: { type: "string" },
    searchDescription: { type: "string" },
    videoType: { type: "string" },
    tone: { type: "array", items: { type: "string" } },
    places: { type: "array", items: { type: "string" } },
    topics: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    people: { type: "array", items: { type: "string" } },
    entities: { type: "array", items: { type: "string" } },
    contentSignals: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    clips: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          topic: { type: "string" },
          emotion: { type: "string" },
          viralScore: { type: "number" },
          startSnippet: { type: "string" },
          endSnippet: { type: "string" },
          hookReason: { type: "string" },
          takeaway: { type: "string" },
          estimatedClipLength: { type: "number" },
          confidence: { type: "number" },
        },
        required: [
          "title",
          "topic",
          "viralScore",
          "hookReason",
          "takeaway",
          "emotion",
          "startSnippet",
          "endSnippet",
          "estimatedClipLength",
          "confidence",
        ],
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
    "clips",
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

• clips
Return every clip that has genuine viral potential, not just the single best moment.
Each clip MUST correspond to one continuous section of the transcript.

The clip begins where the speaker first says startSnippet.

The clip ends where the speaker later says endSnippet.

IMPORTANT:
The endSnippet MUST occur AFTER the startSnippet in the transcript.
Never choose an endSnippet that appears earlier than the startSnippet.

Do not summarize or combine ideas from different parts of the interview.

Both snippets must be copied verbatim from the transcript.
Each clip should represent a complete, self-contained idea.
Describe the emotional feeling of the piece, is it funny, sad, heartfelt, inspiring etc. 
startSnippet should be an exact 4-6 word phrase spoken at the beginning of the clip that is distinctive enough to locate in the transcript. Include the 2-3 words before this point as well to help with timestamp lookups.
endSnippet should be the final distinctive phrase spoken before the clip naturally ends.
It must occur after startSnippet and should be the last important phrase within that continuous

startSnippet:
Return an exact phrase copied verbatim from the transcript that uniquely identifies the beginning of the clip. Choose a phrase that is unlikely to appear elsewhere in the interview. Avoid common phrases such as "I think", "you know", "it's like", etc.

endSnippet:
Return an exact phrase copied verbatim from the transcript that uniquely identifies the end of the clip.
Choose a complete, consecutive phrase from the transcript. Do not end the snippet in the middle of a word group or sentence if a more natural phrase is available.
Snippets should be copied verbatim from the transcript rather than paraphrased.
viralScore should be an integer from 0–100 representing how likely the clip is to perform well as a short-form video.
The model should only include clips it genuinely believes are worth editing, rather than trying to force a fixed number of clips.
Give an estimate in seconds for how long this video clip might last. 
Estimate your confidence level of this analysis, an integer between 0 - 100
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
  console.log(
    `Metadata extraction started...the number of files to process is ${batchSize}`,
  );

  for (const [index, file] of pendingTranscripts.entries()) {
    const inputFile = path.join("output/transcripts", file);

    const outputName = path.parse(file).name;
    const outputFile = path.join("output/metadata", `${outputName}.json`);

    try {
      const transcript = JSON.parse(fs.readFileSync(inputFile, "utf8"));

      const metadata = await extractMetadata(transcript.text);

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
