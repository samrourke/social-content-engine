import { exec } from "child_process";

import fs from "fs";
import path from "path";

export async function extractAudio() {
  const INTERVIEWS_DIR = "input/interviews";

  const videoFiles = fs
    .readdirSync(INTERVIEWS_DIR)
    .filter((file) => file.endsWith(".mp4"));

  const audioFiles = fs
    .readdirSync("output/audio")
    .filter((file) => file.endsWith(".mp3"));

  if (videoFiles.length === 0) {
    console.log("No MP4 files found in /input.");
    return;
  }

  const audioStems = audioFiles.map((file) => path.parse(file).name);

  const pendingVideoFiles = videoFiles.filter((file) => {
    const stem = path.parse(file).name;
    return !audioStems.includes(stem);
  });

  if (pendingVideoFiles.length === 0) {
    console.log("No NEW MP4 files found in /input.");
    return;
  }

  /*Use for/of loop so that each file is processed in turn rather than 
all at once. Works better for large batches. */

  /*function to extract audio from a video  */

  function processAudio(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      exec(
        `ffmpeg -y -i "${inputPath}" -vn -ar 16000 -ac 1 -b:a 64k "${outputPath}"`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(stderr);
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
    let successful = 0;
    let failed = 0;

    console.log(
      `Audio extraction started... the number of files to process is ${batchSize}`,
    );

    for (const [index, file] of pendingVideoFiles.entries()) {
      const outputName = path.parse(file).name;
      const inputFile = path.join(INTERVIEWS_DIR, file);
      const outputFile = path.join("output/audio", `${outputName}.mp3`);

      try {
        await processAudio(inputFile, outputFile);
        successful++;

        console.log(
          `[Audio] (${index + 1}/${batchSize}) ${file} audio extracted`,
        );
      } catch (error) {
        failed++;

        console.error(`[Audio] (${index + 1}/${batchSize}) FAILED: ${file}`);
      }
    }

    console.log("\nAudio extraction complete.");
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
  }

  await processVideos();
}
