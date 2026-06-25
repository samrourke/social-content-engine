import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const transcript = await openai.audio.transcriptions.create({
  file: fs.createReadStream("./audio.wav"),
  model: "gpt-4o-mini-transcribe",
});

console.log(transcript.text);
