import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const BATCH_SIZE = 10;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribe() {
  /* Create array of audio files */

  /*Create Array of existing transcript files */
  const AUDIO_DIR = "output/audio";
  const TRANSCRIPTS_DIR = "output/transcripts";

  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });

  const audioFiles = fs
    .readdirSync(AUDIO_DIR)
    .filter((file) => file.endsWith(".mp3"));

  const transcripts = fs
    .readdirSync(TRANSCRIPTS_DIR)
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

  const batch = processFiles.slice(0, BATCH_SIZE);

  async function transcribeAudio(input) {
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(input),
      model: "whisper-1",
      response_format: "verbose_json",
      language: "en",
    });

    // console.log(JSON.stringify(transcript, null, 2));

    return transcript;
  }

  async function processAudioFiles() {
    const batchSize = batch.length;

    console.log(
      `Transcribing started...the number of files to process is ${batchSize}`,
    );

    for (const [index, file] of batch.entries()) {
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
