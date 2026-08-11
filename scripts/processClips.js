import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

export async function processClips() {
  const execFileAsync = promisify(execFile);

  const INTERVIEWS_DIR = "input/interviews";
  const TRANSCRIPTS_DIR = "output/transcripts";
  const METADATA_DIR = "output/metadata";
  const CLIP_ANALYSIS_DIR = "output/clip-analysis";
  const OUTPUT_CLIPS_DIR = "output/clips";

  const START_PAD = 5;
  const END_PAD = 5;

  async function getJsonFiles(directory) {
    try {
      const files = await fs.readdir(directory);
      return files.filter((file) => file.endsWith(".json"));
    } catch {
      return [];
    }
  }

  async function fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  function normaliseText(text) {
    return text
      .toLowerCase()
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[.,!?;:()\-—]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findSegmentIndexBySnippet(segments, snippet, fromIndex = 0) {
    const target = normaliseText(snippet);

    for (let i = fromIndex; i < segments.length; i++) {
      const segmentText = normaliseText(segments[i].text);

      if (segmentText.includes(target)) {
        return i;
      }

      const nextSegment = segments[i + 1];

      if (nextSegment) {
        const combinedText = normaliseText(
          `${segments[i].text} ${nextSegment.text}`,
        );

        if (combinedText.includes(target)) {
          return i;
        }
      }
    }

    return -1;
  }

  function resolveClipTimes({ transcriptJson, clip }) {
    const segments = transcriptJson.segments;

    if (!Array.isArray(segments) || segments.length === 0) {
      throw new Error("Transcript has no valid segments array.");
    }

    const startIndex = findSegmentIndexBySnippet(segments, clip.startSnippet);

    if (startIndex === -1) {
      throw new Error(`Could not find startSnippet: "${clip.startSnippet}"`);
    }

    const endIndex = findSegmentIndexBySnippet(
      segments,
      clip.endSnippet,
      startIndex,
    );

    if (endIndex === -1) {
      throw new Error(`Could not find endSnippet: "${clip.endSnippet}"`);
    }

    const startTime = Math.max(0, segments[startIndex].start - START_PAD);
    const endTime = segments[endIndex].end + END_PAD;

    if (endTime <= startTime) {
      throw new Error(
        `Invalid clip timing. Start: ${startTime}, End: ${endTime}`,
      );
    }

    return {
      startTime,
      endTime,
      duration: endTime - startTime,
    };
  }

  async function cutClip({ inputVideoPath, outputPath, startTime, endTime }) {
    await execFileAsync("ffmpeg", [
      "-y",
      "-ss",
      String(startTime),
      "-to",
      String(endTime),
      "-i",
      inputVideoPath,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  }

  async function cutClips() {
    console.log("Cutting Clips....");
    await fs.mkdir(OUTPUT_CLIPS_DIR, { recursive: true });

    const clipAnalysisFiles = await getJsonFiles(CLIP_ANALYSIS_DIR);

    // const clipAnalysisFiles = fs
    //   .readdirSync("output/clip-analysis")
    //   .filter((file) => file.endsWith(".json"));

    if (clipAnalysisFiles.length === 0) {
      console.log("No clip analysis files found.");
      return;
    }

    /* Get clips directory */
    const existingClips = (
      await fs.readdir(OUTPUT_CLIPS_DIR, { withFileTypes: true })
    )
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    /* Filter clip directory to find  folders with clips inside - these are already processed. 
Empty ones might need to be processed still so are not included inside processedClips */

    const processedClips = [];

    for (const folder of existingClips) {
      const folderPath = path.join(OUTPUT_CLIPS_DIR, folder);
      const contents = await fs.readdir(folderPath);

      if (contents.length !== 0) {
        processedClips.push(folder);
      }
    }

    const processedClipStems = new Set(
      processedClips.map((folder) => path.parse(folder).name),
    );

    const pendingDataFiles = clipAnalysisFiles.filter((file) => {
      return !processedClipStems.has(path.parse(file).name);
    });

    if (pendingDataFiles.length === 0) {
      console.log("No new Clip Analysis Files found");
      return;
    }

    console.log(`Found ${pendingDataFiles.length} new clip analysis file(s).`);

    for (const analysisFile of pendingDataFiles) {
      const stem = path.parse(analysisFile).name;

      const transcriptPath = path.join(TRANSCRIPTS_DIR, `${stem}.json`);
      const metadataPath = path.join(METADATA_DIR, `${stem}.json`);
      const clipAnalysisPath = path.join(CLIP_ANALYSIS_DIR, analysisFile);
      const inputVideoPath = path.join(INPUT_VIDEO_DIR, `${stem}.mp4`);
      const outputDir = path.join(OUTPUT_CLIPS_DIR, stem);

      const requiredFiles = [
        transcriptPath,
        metadataPath,
        clipAnalysisPath,
        inputVideoPath,
      ];

      const missingFiles = [];

      for (const filePath of requiredFiles) {
        if (!(await fileExists(filePath))) {
          missingFiles.push(filePath);
        }
      }

      if (missingFiles.length > 0) {
        console.warn(`[Skipped] ${stem}. Missing files:`);
        for (const file of missingFiles) {
          console.warn(`- ${file}`);
        }
        continue;
      }

      try {
        const transcriptJson = JSON.parse(
          await fs.readFile(transcriptPath, "utf8"),
        );
        const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
        const clipAnalysis = JSON.parse(
          await fs.readFile(clipAnalysisPath, "utf8"),
        );

        if (!Array.isArray(clipAnalysis.clips)) {
          console.warn(
            `[Skipped] ${stem}. clipAnalysis.clips is not an array.`,
          );
          continue;
        }

        if (clipAnalysis.clips.length === 0) {
          console.log(`[Skipped] ${stem}. No strong clips found.`);
          continue;
        }

        await fs.mkdir(outputDir, { recursive: true });

        console.log(
          `[Processing] ${stem}: ${clipAnalysis.clips.length} clip candidate(s).`,
        );

        for (const [index, clip] of clipAnalysis.clips.entries()) {
          try {
            const { startTime, endTime, duration } = resolveClipTimes({
              transcriptJson,
              clip,
            });

            const safeTitle = clip.title
              ? clip.title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)/g, "")
                  .slice(0, 50)
              : `clip-${index + 1}`;

            const outputFileName = `clip_${index + 1}_${safeTitle}.mp4`;
            const outputPath = path.join(outputDir, outputFileName);

            await cutClip({
              inputVideoPath,
              outputPath,
              startTime,
              endTime,
            });

            const sidecarJsonPath = path.join(
              outputDir,
              `clip_${index + 1}_${safeTitle}.json`,
            );

            await fs.writeFile(
              sidecarJsonPath,
              JSON.stringify(
                {
                  source: {
                    stem,
                    videoPath: inputVideoPath,
                    transcriptPath,
                    metadataPath,
                    clipAnalysisPath,
                    title: metadata.title,
                    videoType: metadata.videoType,
                  },
                  clip,
                  timing: {
                    startTime,
                    endTime,
                    duration,
                  },
                },
                null,
                2,
              ),
            );

            console.log(
              `[Clip] ${stem} (${index + 1}/${clipAnalysis.clips.length}) exported: ${outputPath}`,
            );
          } catch (error) {
            console.error(
              `[Clip Error] ${stem} clip ${index + 1}: ${error.message}`,
            );
          }
        }
      } catch (error) {
        console.error(`[Error] Failed to process ${stem}`);
        console.error(error);
      }
    }

    console.log("Clip processing complete.");
  }

  await cutClips();
}
