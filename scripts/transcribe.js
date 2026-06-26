import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* Create array of audio files */

const audioFiles = fs
  .readdirSync("output/audio")
  .filter((file) => file.endsWith(".mp3"));

/*Create Array of existing transcript files */

const transcripts = fs
  .readdirSync("output/transcripts")
  .filter((file) => file.endsWith(".txt"));

/*if no audio files - return */

if (audioFiles.length === 0) {
  console.log("No audio files found in /output/audio");
  process.exit(0);
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
  process.exit(0);
}

// function transcribeAudio(input, output) {
//   return new Promise((resolve, reject) => {
//     try {
//       const transcript = await openai.audio.transcriptions.create({
//         file: fs.createReadStream(input),
//         model: "whisper-1",
//       });
//       fs.writeFileSync(`${output}.txt`, transcript.text);

//       const outputFile = path.join("output/transcripts", `${output}.txt`);

//       // console.log(JSON.stringify(transcript, null, 2));

//       resolve();

//     } catch (error) {
//       reject(error);
//       console.error(error);
//       return;
//     }
//   });
// }

async function transcribeAudio(input) {
  const transcript = await openai.audio.transcriptions.create({
    file: fs.createReadStream(input),
    model: "whisper-1",
  });

  return transcript.text;
}

async function processAudioFiles() {
  const batchSize = processFiles.length;
  for (const [index, file] of processFiles.entries()) {
    const outputName = path.parse(file).name;
    const outputFile = path.join("output/transcripts", `${outputName}.txt`);

    const inputFile = path.join("output/audio", file);

    try {
      const transcript = await transcribeAudio(inputFile);
      fs.writeFileSync(outputFile, transcript);
      console.log(
        `[Transcript] (${index + 1}/${batchSize}) ${inputFile} successfully transcribed`,
      );
    } catch (error) {
      console.error(error);
    }
  }
}

await processAudioFiles();

// try {
//   const transcript = await openai.audio.transcriptions.create({
//     file: fs.createReadStream("./audio.mp3"),
//     model: "whisper-1",
//   });
//   fs.writeFileSync("whisper-transcript.txt", transcript.text);

//   console.log(JSON.stringify(transcript, null, 2));
// } catch (error) {
//   console.error(error);
// }
