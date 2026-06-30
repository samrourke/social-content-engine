import { extractAudio } from "./extractAudio.js";
import { transcribeAudioFiles } from "./transcribe.js";
import { extractMetadata } from "./extractMetadata.js";
import { analyseClips } from "./analyseClips.js";
import { processClips } from "./processClips.js";

async function runPipeline() {
  try {
    console.log("Starting content pipeline...");

    await extractAudio();
    await transcribeAudioFiles();
    await extractMetadata();
    await analyseClips();
    await processClips();

    console.log("Pipeline complete.");
  } catch (error) {
    console.error("Pipeline failed:");
    console.error(error);
    process.exit(1);
  }
}

await runPipeline();
