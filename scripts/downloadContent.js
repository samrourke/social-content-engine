import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify, parseArgs } from "util";
import { CATEGORY_DIRECTORIES } from "../config/archiveCategories.js";

dotenv.config({ path: ".env" });

const execFileAsync = promisify(execFile);

const INPUT_DIR = "input";
const TABLE_NAME = "circa_full_content";
const BATCH_SIZE = 50;

// Optional: node scripts/downloadContent.js --platform instagram
// downloads only that platform's queue.
const { values: args } = parseArgs({
  options: { platform: { type: "string" } },
});

function getOutputDirectory(source) {
  const category = source.archive_category?.trim().toLowerCase() ?? "other";

  const directoryName = CATEGORY_DIRECTORIES[category] ?? "other";

  return path.join(INPUT_DIR, directoryName);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function sanitiseFilename(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/*make sure URL is valid, remove any excess text and whitespace */

function extractUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = value.match(/https?:\/\/[^\s]+/i);

  return match ? match[0].trim() : null;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function updateSource(id, values) {
  const { error } = await supabase
    .from(TABLE_NAME)
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Supabase update failed: ${error.message}`);
  }
}

async function getPendingSources() {
  let query = supabase
    .from(TABLE_NAME)
    .select(
      `
        id,
        title,
        source_url,
        archive_category,
        carousel_slides,
        downloaded_filename,
        download_status
      `,
    )
    .in("download_status", ["pending", "failed"])
    .not("source_url", "is", null)
    .limit(BATCH_SIZE);

  if (args.platform) {
    query = query.eq("platform", args.platform);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not load download queue: ${error.message}`);
  }

  return data ?? [];
}

function isInstagramUrl(url) {
  return /^https?:\/\/(www\.)?instagram\.com\//i.test(url);
}

/*
 * Instagram carousels download as a playlist, one file per video slide.
 * Photo slides make yt-dlp report errors, which are skipped; yt-dlp then exits
 * non-zero even though the videos downloaded, so its output is still used and
 * the files are checked below.
 */
async function runYtDlp(args, allowPartialFailure) {
  try {
    return await execFileAsync("yt-dlp", args, {
      maxBuffer: 1024 * 1024 * 20,
    });
  } catch (error) {
    if (allowPartialFailure && error.stdout?.trim()) {
      return { stdout: error.stdout, stderr: error.stderr };
    }

    throw error;
  }
}

async function findExistingDownloads(outputDirectory, sourceId) {
  const entries = await fs.readdir(outputDirectory).catch(() => []);

  return entries
    .filter((name) => name.endsWith(`-${sourceId}.mp4`))
    .map((name) => path.join(outputDirectory, name));
}

async function downloadVideo(source) {
  const sourceUrl = extractUrl(source.source_url);

  if (!sourceUrl) {
    throw new Error(`No valid URL found in source_url: ${source.source_url}`);
  }

  const safeTitle = sanitiseFilename(source.title || "untitled-video");
  const outputDirectory = getOutputDirectory(source);

  await fs.mkdir(outputDirectory, { recursive: true });

  /*
   * Including the database ID guarantees uniqueness when multiple
   * videos have the same title.
   */
  const stem = `${safeTitle}-${source.id}`;
  const isInstagram = isInstagramUrl(sourceUrl);

  /*
   * Carousel videos get their slide number before the ID, e.g.
   * title-slide17-<id>.mp4, so removeOrphanedDownloads.js still finds the ID
   * at the end of the filename. Single videos keep title-<id>.mp4.
   */
  const outputTemplate = isInstagram
    ? path.join(
        outputDirectory,
        `${safeTitle}%(playlist_index&-slide{}|)s-${source.id}.%(ext)s`,
      )
    : path.join(outputDirectory, `${stem}.%(ext)s`);
  const expectedOutputPath = path.join(outputDirectory, `${stem}.mp4`);

  const existingDownloads = await findExistingDownloads(
    outputDirectory,
    source.id,
  );

  if (existingDownloads.length > 0) {
    console.log(`[Already downloaded] ${existingDownloads.join(", ")}`);

    await updateSource(source.id, {
      download_status: "downloaded",
      downloaded_filename: existingDownloads
        .map((filePath) => path.relative(INPUT_DIR, filePath))
        .join(", "),
      downloaded_at: new Date().toISOString(),
      download_error: null,
    });

    return existingDownloads;
  }

  await updateSource(source.id, {
    download_status: "downloading",
    download_error: null,
  });

  console.log(
    `[Downloading ${source.archive_category ?? "Other"}] ${source.title}`,
  );
  console.log(sourceUrl);

  const playlistArgs = isInstagram
    ? [
        "--ignore-errors",
        ...(source.carousel_slides?.length
          ? ["--playlist-items", source.carousel_slides.join(",")]
          : []),
      ]
    : ["--no-playlist"];

  if (source.carousel_slides?.length) {
    console.log(`Carousel slides: ${source.carousel_slides.join(", ")}`);
  }

  const args = [
    ...playlistArgs,
    "--newline",

    "--cookies-from-browser",
    "firefox",

    "--format",
    "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b",

    "--merge-output-format",
    "mp4",

    "--output",
    outputTemplate,

    "--print",
    "after_move:filepath",

    sourceUrl,
  ];

  const { stdout, stderr } = await runYtDlp(args, isInstagram);

  if (stderr?.trim()) {
    console.log(stderr.trim());
  }

  const outputLines = stdout
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // One reported path per downloaded video (several for a carousel)
  const finalPaths = [];

  for (const line of outputLines) {
    if (line.endsWith(".mp4") && (await fileExists(line))) {
      finalPaths.push(line);
    }
  }

  if (finalPaths.length === 0 && (await fileExists(expectedOutputPath))) {
    finalPaths.push(expectedOutputPath);
  }

  if (finalPaths.length === 0) {
    throw new Error(
      `yt-dlp finished but the expected output file was not found: ${expectedOutputPath}`,
    );
  }

  /*
   * Store the path relative to input, for example:
   * interviews/video-title-id.mp4
   * fan-live/video-title-slide17-id.mp4, fan-live/video-title-slide19-id.mp4
   */

  const storedFilename = finalPaths
    .map((filePath) => path.relative(INPUT_DIR, filePath))
    .join(", ");

  await updateSource(source.id, {
    download_status: "downloaded",
    downloaded_filename: storedFilename,
    downloaded_at: new Date().toISOString(),
    download_error: null,
  });

  for (const finalPath of finalPaths) {
    console.log(`[Downloaded] ${finalPath}`);
  }

  return finalPaths;
}

export async function downloadContent() {
  await Promise.all(
    Object.values(CATEGORY_DIRECTORIES).map((directory) =>
      fs.mkdir(path.join(INPUT_DIR, directory), {
        recursive: true,
      }),
    ),
  );

  const sources = await getPendingSources();

  if (sources.length === 0) {
    console.log("No videos waiting to be downloaded.");
    return;
  }

  console.log(`Found ${sources.length} video(s) to download.`);

  const categoryCounts = {};

  let successfulDownloads = 0;
  let failedDownloads = 0;

  for (const source of sources) {
    const category = source.archive_category?.trim() || "Other";

    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
  }

  for (const [category, count] of Object.entries(categoryCounts)) {
    console.log(`${category}: ${count}`);
  }

  for (const [index, source] of sources.entries()) {
    console.log(
      `\n[Download ${index + 1}/${sources.length}] ${source.title || source.id}`,
    );

    try {
      await downloadVideo(source);

      successfulDownloads++;
    } catch (error) {
      failedDownloads++;

      const message =
        error instanceof Error ? error.message : "Unknown download error";

      console.error(`[Download failed] ${source.title || source.id}`);
      console.error(message);

      try {
        await updateSource(source.id, {
          download_status: "failed",
          download_error: message.slice(0, 2000),
        });
      } catch (updateError) {
        console.error("Could not record failure in Supabase:");
        console.error(updateError);
      }
    }
  }

  console.log("\n----------------------------");
  console.log("DOWNLOAD SUMMARY");
  console.log("----------------------------");
  console.log(`Attempted:   ${sources.length}`);
  console.log(`Successful:  ${successfulDownloads}`);
  console.log(`Failed:      ${failedDownloads}`);
  console.log("----------------------------");
}

await downloadContent();
