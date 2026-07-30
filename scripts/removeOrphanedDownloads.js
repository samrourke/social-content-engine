import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

dotenv.config({ path: ".env" });

const TABLE_NAME = "circa_full_content";

const VIDEO_DIRECTORIES = ["input/interview", "input/performance"];

const QUARANTINE_DIRECTORY = "output/orphaned-duplicates";

const DRY_RUN = false; // Set to true to simulate the cleanup without moving files

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const UUID_PATTERN =
  /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?=\.[^.]+$)/i;

async function getCurrentDatabaseIds() {
  const { data, error } = await supabase.from(TABLE_NAME).select("id");

  if (error) {
    throw new Error(`Failed to retrieve database IDs: ${error.message}`);
  }

  return new Set(data.map((row) => row.id.toLowerCase()));
}

async function getVideoFiles(directory) {
  const videoFiles = [];

  async function walk(currentDirectory) {
    let entries;

    try {
      entries = await fs.readdir(currentDirectory, {
        withFileTypes: true,
      });
    } catch (error) {
      if (error.code === "ENOENT") {
        console.warn(`Directory not found: ${currentDirectory}`);
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (entry.name.toLowerCase().endsWith(".mp4")) {
        videoFiles.push(fullPath);
      }
    }
  }

  await walk(directory);

  return videoFiles;
}

function extractUuid(filePath) {
  const filename = path.basename(filePath);
  const match = filename.match(UUID_PATTERN);

  return match ? match[1].toLowerCase() : null;
}

async function moveToQuarantine(filePath) {
  const relativePath = path.relative("input", filePath);
  const destination = path.join(QUARANTINE_DIRECTORY, relativePath);

  await fs.mkdir(path.dirname(destination), {
    recursive: true,
  });

  await fs.rename(filePath, destination);

  return destination;
}

async function removeOrphanedDownloads() {
  const currentIds = await getCurrentDatabaseIds();

  console.log(`Current database records: ${currentIds.size}`);

  const files = [];

  for (const directory of VIDEO_DIRECTORIES) {
    files.push(...(await getVideoFiles(directory)));
  }

  console.log(`Downloaded video files: ${files.length}`);

  const orphanedFiles = [];
  const unmatchedFiles = [];
  const retainedFiles = [];

  for (const filePath of files) {
    const uuid = extractUuid(filePath);

    if (!uuid) {
      unmatchedFiles.push(filePath);
      continue;
    }

    if (currentIds.has(uuid)) {
      retainedFiles.push(filePath);
    } else {
      orphanedFiles.push({
        filePath,
        uuid,
      });
    }
  }

  console.log("\nCleanup summary");
  console.log("----------------");
  console.log(`Files to retain: ${retainedFiles.length}`);
  console.log(`Orphaned files: ${orphanedFiles.length}`);
  console.log(`Files without a recognisable UUID: ${unmatchedFiles.length}`);

  if (unmatchedFiles.length > 0) {
    console.log("\nFiles without UUIDs:");

    for (const filePath of unmatchedFiles) {
      console.log(`  ${filePath}`);
    }
  }

  if (orphanedFiles.length === 0) {
    console.log("\nNo orphaned files found.");
    return;
  }

  console.log("\nOrphaned files:");

  for (const orphan of orphanedFiles) {
    console.log(`  ${orphan.filePath}`);
  }

  if (DRY_RUN) {
    console.log("\nDry run enabled. No files were moved or deleted.");
    return;
  }

  console.log("\nMoving orphaned files to quarantine...");

  for (const orphan of orphanedFiles) {
    const destination = await moveToQuarantine(orphan.filePath);

    console.log(`Moved: ${orphan.filePath}`);
    console.log(`   To: ${destination}`);
  }

  const reportPath = path.join(QUARANTINE_DIRECTORY, "orphaned-files.json");

  await fs.mkdir(QUARANTINE_DIRECTORY, {
    recursive: true,
  });

  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        processedAt: new Date().toISOString(),
        databaseRecordCount: currentIds.size,
        downloadedFileCount: files.length,
        orphanedFileCount: orphanedFiles.length,
        orphanedFiles,
      },
      null,
      2,
    ),
  );

  console.log(`\nReport written to: ${reportPath}`);
}

removeOrphanedDownloads().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exitCode = 1;
});
