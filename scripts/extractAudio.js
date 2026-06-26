import { exec } from "child_process";

import fs from "fs";
import path from "path";

const videoFiles = fs
  .readdirSync("input")
  .filter((file) => file.endsWith(".mp4"));

const transcriptFiles = fs
  .readdirSync("output/audio")
  .filter((file) => file.endsWith(".txt"));

if (videoFiles.length === 0) {
  console.log("No MP4 files found in /input.");
  process.exit(0);
}

const transcriptStems = transcriptFiles.map((file) => path.parse(file).name);

const processFiles = videoFiles.filter((file) => {
  const stem = path.parse(file).name;
  return !transcriptStems.includes(stem);
});

if (processFiles.length === 0) {
  console.log("No NEW MP4 files found in /input.");
  process.exit(0);
}

/*Use for/of loop so that each file is processed in turn rather than 
all at once. Works better for large batches. */

/*function to extract audio from a video  */

function extractAudio(input, output) {
  return new Promise((resolve, reject) => {
    exec(`ffmpeg -i "${input}" "${output}"`, (error) => {
      if (error) {
        reject(error);
        console.error(error);
        return;
      }
      resolve();
    });
  });
}

async function processVideos() {
  const batchSize = processFiles.length;
  for (const [index, file] of processFiles.entries()) {
    const outputName = path.parse(file).name;
    const inputFile = path.join("input", file);
    const outputFile = path.join("output", `${outputName}.mp3`);

    await extractAudio(inputFile, outputFile);

    console.log(
      `[Audio] (${index + 1}/${batchSize}) ${inputFile} audio extracted`,
    );
  }
}

await processVideos();

// const newestFile = videoFiles.sort((a, b) => {
//   const aTime = fs.statSync(`input/${a}`).mtimeMs;
//   const bTime = fs.statSync(`input/${b}`).mtimeMs;

//   return bTime - aTime;
// })[0];

// const outputName = newestFile.substring(0, newestFile.length - 4);

// const inputFile = path.join("input", newestFile);
// const outputFile = path.join("output", `${outputName}.mp3`);

// exec(`ffmpeg -i "${inputFile}" "${outputFile}"`, (error) => {
//   if (error) {
//     console.error(error);
//     return;
//   }

//   console.log("Audio extracted!");
// });
