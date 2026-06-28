import { exec } from "child_process";

import fs from "fs";
import path from "path";

const videoFiles = fs
  .readdirSync("input")
  .filter((file) => file.endsWith(".mp4"));

const audioFiles = fs
  .readdirSync("output/audio")
  .filter((file) => file.endsWith(".mp3"));

if (videoFiles.length === 0) {
  console.log("No MP4 files found in /input.");
  process.exit(0);
}

const audioStems = audioFiles.map((file) => path.parse(file).name);

const pendingVideoFiles = videoFiles.filter((file) => {
  const stem = path.parse(file).name;
  return !audioStems.includes(stem);
});

if (pendingVideoFiles.length === 0) {
  console.log("No NEW MP4 files found in /input.");
  process.exit(0);
}

/*Use for/of loop so that each file is processed in turn rather than 
all at once. Works better for large batches. */

/*function to extract audio from a video  */

function extractAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    exec(
      `ffmpeg -y -i "${inputPath}" -vn -ar 16000 -ac 1 -b:a 64k "${outputPath}"`,
      (error, stdout, stderr) => {
        console.log(stderr);

        if (error) {
          console.error(error);
          reject(error);
          return;
        }

        resolve();
      },
    );
  });
}

async function processVideos() {
  const batchSize = pendingVideoFiles.length;
  console.log(
    `audio extraction started...the number of files to process is ${batchSize}`,
  );
  for (const [index, file] of pendingVideoFiles.entries()) {
    const outputName = path.parse(file).name;
    const inputFile = path.join("input", file);
    const outputFile = path.join("output/audio", `${outputName}.mp3`);

    console.log(inputFile);
    console.log(outputFile);

    await extractAudio(inputFile, outputFile);

    console.log(
      `[Audio] (${index + 1}/${batchSize}) ${inputFile} audio extracted`,
    );
  }
}

await processVideos();
