import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribe() {
  /* Create array of audio files */

  const audioFiles = fs
    .readdirSync("output/audio")
    .filter((file) => file.endsWith(".mp3"));

  /*Create Array of existing transcript files */

  const transcripts = fs
    .readdirSync("output/transcripts")
    .filter((file) => file.endsWith(".json"));

  /*if no audio files - return */

  if (audioFiles.length === 0) {
    console.log("No audio files found in /output/audio");
    return;
  }

  /*Create array of strings matching each transcript file name*/

  const transcriptStems = transcripts.map((file) => path.parse(file).name);

  /*Filter audioFiles array by removing any file that 
shares a file name with a transcript text file - !transcriptStems.includes(stem). 
It's already processed */

  const processFiles = audioFiles.filter((file) => {
    const stem = path.parse(file).name;
    return !transcriptStems.includes(stem);
  });

  /*if no new mp3s found then return */

  if (processFiles.length === 0) {
    console.log("No NEW mp3 files found in /output/audio");
    return;
  }

  async function transcribeAudio(input) {
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(input),
      model: "whisper-1",
      response_format: "verbose_json",
    });

    // console.log(JSON.stringify(transcript, null, 2));

    return transcript;
  }

  async function processAudioFiles() {
    const batchSize = processFiles.length;

    console.log(
      `Transcribing started...the number of files to process is ${batchSize}`,
    );

    for (const [index, file] of processFiles.entries()) {
      const inputFile = path.join("output/audio", file);
      const outputName = path.parse(file).name;
      const outputFile = path.join("output/transcripts", `${outputName}.json`);

      try {
        const transcript = await transcribeAudio(inputFile);

        fs.writeFileSync(outputFile, JSON.stringify(transcript, null, 2));

        console.log(
          `[Transcript] (${index + 1}/${batchSize}) ${inputFile} successfully transcribed`,
        );
      } catch (error) {
        console.error(`[Transcript failed] ${inputFile}`);
        console.error(error);
      }
    }
  }

  await processAudioFiles();
}
