import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

try {
  const transcript = await openai.audio.transcriptions.create({
    file: fs.createReadStream("./audio.mp3"),
    model: "whisper-1",
  });
  fs.writeFileSync("whisper-transcript.txt", transcript.text);

  console.log(JSON.stringify(transcript, null, 2));
} catch (error) {
  console.error(error);
}
