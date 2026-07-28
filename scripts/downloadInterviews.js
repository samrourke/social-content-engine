import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

dotenv.config({ path: ".env" });

const execFileAsync = promisify(execFile);

const INPUT_DIR = "input";
const TABLE_NAME = "content_sources";
const BATCH_SIZE = 2;

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
    .select("id, title, source_url, downloaded_filename, download_status")
    .in("download_status", ["pending", "failed"])
    .not("source_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    throw new Error(`Could not load download queue: ${error.message}`);
  }

  return data ?? [];
}

async function downloadVideo(source) {
  const safeTitle = sanitiseFilename(source.title || "interview");

  /*
   * Including the database ID guarantees uniqueness even where two
   * interviews have the same title.
   */
  const stem = `${safeTitle}-${source.id}`;
  const outputTemplate = path.join(INPUT_DIR, `${stem}.%(ext)s`);
  const expectedOutputPath = path.join(INPUT_DIR, `${stem}.mp4`);

  if (await fileExists(expectedOutputPath)) {
    console.log(`[Already downloaded] ${expectedOutputPath}`);

    await updateSource(source.id, {
      download_status: "downloaded",
      downloaded_filename: `${stem}.mp4`,
      downloaded_at: new Date().toISOString(),
      download_error: null,
    });

    return expectedOutputPath;
  }

  await updateSource(source.id, {
    download_status: "downloading",
    download_error: null,
  });

  console.log(`[Downloading] ${source.title}`);
  console.log(source.source_url);

  /*
   * Format preference:
   * 1. MP4 video up to 1080p + M4A audio
   * 2. Any video up to 1080p + best audio
   * 3. Best combined format up to 1080p
   */
  const args = [
    "--no-playlist",
    "--newline",
    "--format",
    "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b",
    "--merge-output-format",
    "mp4",
    "--output",
    outputTemplate,
    "--print",
    "after_move:filepath",
    source.source_url,
  ];

  const { stdout, stderr } = await execFileAsync("yt-dlp", args, {
    maxBuffer: 1024 * 1024 * 20,
  });

  if (stderr?.trim()) {
    console.log(stderr.trim());
  }

  /*
   * The last stdout line printed by after_move:filepath should be the
   * final path after yt-dlp has merged or remuxed the file.
   */
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

  const finalFilename = path.basename(finalPath);

  await updateSource(source.id, {
    download_status: "downloaded",
    downloaded_filename: finalFilename,
    downloaded_at: new Date().toISOString(),
    download_error: null,
  });

  console.log(`[Downloaded] ${finalPath}`);

  return finalPath;
}

export async function downloadInterviews() {
  await fs.mkdir(INPUT_DIR, { recursive: true });

  const sources = await getPendingSources();

  if (sources.length === 0) {
    console.log("No interviews waiting to be downloaded.");
    return;
  }

  console.log(`Found ${sources.length} interview(s) to download.`);

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

await downloadInterviews();
