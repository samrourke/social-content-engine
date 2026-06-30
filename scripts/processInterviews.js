import { extractAudio } from "./extractAudio.js";
import { transcribe } from "./transcribe.js";
import { extractMetadata } from "./extractMetadata.js";
import { selectClips } from "./selectClips.js";
import { processClips } from "./processClips.js";

async function runPipeline() {
  try {
    console.log("Starting content pipeline...");

    await extractAudio();

    await transcribe();

    await extractMetadata();

    await selectClips();

    await processClips();

    console.log("Pipeline complete.");
  } catch (error) {
    console.error("Pipeline failed:");
    console.error(error);
    process.exit(1);
  }
}

await runPipeline();
