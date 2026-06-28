import { exec } from "child_process";
import fs from "fs";
import path from "path";

/*Get all metaData files */

const dataFiles = fs
  .readdirSync("output/metadata")
  .filter((file) => file.endsWith(".json"));

/*Get all transcript files */

const transcriptFiles = fs
  .readdirSync("output/transcripts")
  .filter((file) => file.endsWith(".json"));

/* Get clips directory */
const clips = fs
  .readdirSync("output/clips", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

/*Get video files */

const videoFiles = fs
  .readdirSync("input")
  .filter((file) => file.endsWith(".mp4"));

/* Filter clip directory to find  folders with clips inside - these are already processed. 
Empty ones might need to be processed still so are not included inside processedClips */

const processedClips = clips.filter((folder) => {
  const folderPath = path.join("output/clips", folder);
  const contents = fs.readdirSync(folderPath);

  return contents.length !== 0;
});

/*If no metadata files return */

if (dataFiles.length === 0) {
  console.log("No data files found in /output/metadata");
  process.exit(0);
}
/*Find all data files with no matching clips folder OR if matching folder but it is empty


Using a Set rather than an array because we're repeatedly checking
whether a filename exists. Sets provide very fast lookups using .has()
and automatically ensure every value is unique.
*/

const processedClipStems = new Set(
  processedClips.map((folder) => path.parse(folder).name),
);

const pendingDataFiles = dataFiles.filter((file) => {
  return !processedClipStems.has(path.parse(file).name);
});

/*Get all Transcripts that match the pendingDataFiles  */

const pendingTranscripts = transcriptFiles.filter((file) => {
  return !processedClipStems.has(path.parse(file).name);
});

if (pendingDataFiles.length === 0) {
  console.log("No NEW data files found in /output/metadata");
  process.exit(0);
}

/*Filter video files to find ones that match titles inside pendingFiles also. 

 should now have a collection of matching transcripts, video files and metadata objects
 inside pendingDataFiles, pendingTranscripts and pendingVideoFiles.
*/

const pendingStems = new Set(
  pendingDataFiles.map((file) => path.parse(file).name),
);

const pendingVideoFiles = videoFiles.filter((video) =>
  pendingStems.has(path.parse(video).name),
);

/*Extract in and out times for every clip in every pendingData file */

const clipTimeStamps = [];

/*inside each meta data object is a list of clips with a start snippet and an end snippet
I need to look up these snippets inside transcripts/file.json 


*/

/*normalize text to remove mismatches due to puncutation, capitalisation etc */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, "") // remove punctuation (keeps apostrophes)
    .replace(/\s+/g, " ")
    .trim();
}

/* Functions to trim star and end snippets to 4 words for searching*/

function firstWords(text, count = 4) {
  return text.split(/\s+/).slice(0, count).join(" ");
}

function lastWords(text, count = 4) {
  return text.split(/\s+/).slice(-count).join(" ");
}

/*Function to find the correspondng segment inside the transcript file

if a snippet runs across two segments it will return undefined

if this happens, join segments into pairs and then find which pair of 
segments the snippet is inside and return timestamp value.
*/

function findSegment(snippet, segments, type = "start") {
  const search = normalize(snippet);

  // Single segment
  const match = segments.find((segment) =>
    normalize(segment.text).includes(search),
  );

  if (match) {
    return type === "start" ? match.start : match.end;
  }

  // Two consecutive segments
  for (let i = 0; i < segments.length - 1; i++) {
    const combined = normalize(`${segments[i].text} ${segments[i + 1].text}`);

    if (combined.includes(search)) {
      return type === "start" ? segments[i].start : segments[i + 1].end;
    }
  }

  return undefined;
}
function extractClips({ inputPath, outputPath, startTime, endTime }) {
  return new Promise((resolve, reject) => {
    const command = `
      ffmpeg
      -y
      -ss ${startTime}
      -to ${endTime}
      -i "${inputPath}"
      -c:v libx264
      -c:a aac
      "${outputPath}"
    `
      .replace(/\s+/g, " ")
      .trim();

    console.log(command);

    exec(command, (error, stdout, stderr) => {
      console.log(stderr);

      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function findTimeStamps() {
  const batchSize = pendingDataFiles.length;
  console.log(
    `clip extraction started...the number of files to process is ${batchSize}`,
  );

  for (const [index, file] of pendingDataFiles.entries()) {
    console.log(`file ${index + 1} extraction started`);

    const fileName = path.parse(file).name;
    const dataInputFile = path.join("output/metadata", file);
    const transcriptInputFile = path.join("output/transcripts", file);
    const directoryName = path.join("output/clips", path.parse(file).name);
    const videoFile = path.join("input/", `${fileName}.mp4`);

    /*Check if a folder matching the file name exists, if not then create it */
    if (!fs.existsSync(directoryName)) {
      fs.mkdirSync(directoryName, { recursive: true });
    }

    try {
      const transcript = JSON.parse(
        fs.readFileSync(transcriptInputFile, "utf8"),
      );
      const segments = transcript.segments;
      const metadata = JSON.parse(fs.readFileSync(dataInputFile, "utf8"));
      const clips = metadata.clips;

      /*Find start and end snippet of each clip */
      const snippets = clips.map((clip) => ({
        start: clip.startSnippet,
        end: clip.endSnippet,
      }));

      for (const clip of clips) {
        clip.startTime = findSegment(clip.startSnippet, segments, "start");
        clip.endTime = findSegment(clip.endSnippet, segments, "end");
      }

      for (const [index, clip] of clips.entries()) {
        const clipBatchSize = clips.length;
        const inputPath = videoFile;
        const outputPath = path.join(
          "output",
          "clips",
          fileName,
          `clip_${index + 1}.mp4`,
        );
        const startTime = Math.max(0, clip.startTime - 0.3);
        const endTime = clip.endTime + 0.3;

        if (clip.startTime >= clip.endTime) {
          console.warn(`Skipping invalid clip: ${clip.title}`);
          continue;
        }

        await extractClips({ inputPath, outputPath, startTime, endTime });

        console.log(
          `[Clips] (${index + 1}/${clipBatchSize}) ${outputPath} extracted`,
        );
      }
    } catch (error) {
      console.error(error);
    }
  }
}

findTimeStamps();
