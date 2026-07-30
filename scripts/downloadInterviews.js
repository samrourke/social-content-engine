import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

dotenv.config({ path: ".env" });

const execFileAsync = promisify(execFile);

const INPUT_DIR = "input";
const INTERVIEWS_DIR = path.join(INPUT_DIR, "interview");
const PERFORMANCES_DIR = path.join(INPUT_DIR, "performance");

const TABLE_NAME = "circa_full_content";
const BATCH_SIZE = 56;

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

function isInterview(source) {
  return source.archive_category?.trim().toLowerCase() === "interview";
}

function getOutputDirectory(source) {
  return isInterview(source) ? INTERVIEWS_DIR : PERFORMANCES_DIR;
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
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      `
        id,
        title,
        source_url,
        archive_category,
        downloaded_filename,
        download_status
      `,
    )
    .in("download_status", ["pending", "failed"])
    .not("source_url", "is", null)
    .limit(BATCH_SIZE);

  if (error) {
    throw new Error(`Could not load download queue: ${error.message}`);
  }

  return data ?? [];
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

  const outputTemplate = path.join(outputDirectory, `${stem}.%(ext)s`);
  const expectedOutputPath = path.join(outputDirectory, `${stem}.mp4`);

  if (await fileExists(expectedOutputPath)) {
    console.log(`[Already downloaded] ${expectedOutputPath}`);

    await updateSource(source.id, {
      download_status: "downloaded",
      downloaded_filename: path.relative(INPUT_DIR, expectedOutputPath),
      downloaded_at: new Date().toISOString(),
      download_error: null,
    });

    return expectedOutputPath;
  }

  await updateSource(source.id, {
    download_status: "downloading",
    download_error: null,
  });

  console.log(
    `[Downloading ${isInterview(source) ? "interview" : "performance"}] ${
      source.title
    }`,
  );
  console.log(sourceUrl);

  const args = [
    "--no-playlist",
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

  const { stdout, stderr } = await execFileAsync("yt-dlp", args, {
    maxBuffer: 1024 * 1024 * 20,
  });

  if (stderr?.trim()) {
    console.log(stderr.trim());
  }

  const outputLines = stdout
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const reportedOutputPath = outputLines.at(-1);

  const finalPath =
    reportedOutputPath && (await fileExists(reportedOutputPath))
      ? reportedOutputPath
      : expectedOutputPath;

  if (!(await fileExists(finalPath))) {
    throw new Error(
      `yt-dlp finished but the expected output file was not found: ${finalPath}`,
    );
  }

  /*
   * Store the path relative to input, for example:
   * interviews/video-title-id.mp4
   * performances/video-title-id.mp4
   */
  const storedFilename = path.relative(INPUT_DIR, finalPath);

  await updateSource(source.id, {
    download_status: "downloaded",
    downloaded_filename: storedFilename,
    downloaded_at: new Date().toISOString(),
    download_error: null,
  });

  console.log(`[Downloaded] ${finalPath}`);

  return finalPath;
}

export async function downloadContent() {
  await Promise.all([
    fs.mkdir(INTERVIEWS_DIR, { recursive: true }),
    fs.mkdir(PERFORMANCES_DIR, { recursive: true }),
  ]);

  const sources = await getPendingSources();

  if (sources.length === 0) {
    console.log("No videos waiting to be downloaded.");
    return;
  }

  const interviewCount = sources.filter(isInterview).length;
  const performanceCount = sources.length - interviewCount;

  console.log(`Found ${sources.length} video(s) to download.`);
  console.log(`Interviews: ${interviewCount}`);
  console.log(`Performances: ${performanceCount}`);

  for (const [index, source] of sources.entries()) {
    console.log(
      `\n[Download ${index + 1}/${sources.length}] ${source.title || source.id}`,
    );

    try {
      await downloadVideo(source);
    } catch (error) {
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

  console.log("\nDownload queue complete.");
}

await downloadContent();
