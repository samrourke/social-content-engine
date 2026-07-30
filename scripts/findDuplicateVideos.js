import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";

const VIDEO_DIRECTORIES = ["input/interview", "input/performance"];

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
  ".avi",
  ".m4v",
]);

async function getVideoFiles(directory) {
  const files = [];

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

      const extension = path.extname(entry.name).toLowerCase();

      if (VIDEO_EXTENSIONS.has(extension)) {
        files.push(fullPath);
      }
    }
  }

  await walk(directory);

  return files;
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fsSync.createReadStream(filePath);

    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function findDuplicateVideos() {
  const allFiles = [];

  for (const directory of VIDEO_DIRECTORIES) {
    const files = await getVideoFiles(directory);
    allFiles.push(...files);
  }

  console.log(`Found ${allFiles.length} video files.`);

  const filesByHash = new Map();

  for (const [index, filePath] of allFiles.entries()) {
    const stats = await fs.stat(filePath);
    const hash = await hashFile(filePath);

    const record = {
      filePath,
      sizeBytes: stats.size,
      sizeMb: Number((stats.size / 1024 / 1024).toFixed(2)),
    };

    if (!filesByHash.has(hash)) {
      filesByHash.set(hash, []);
    }

    filesByHash.get(hash).push(record);

    console.log(`[${index + 1}/${allFiles.length}] Hashed: ${filePath}`);
  }

  const duplicateGroups = [...filesByHash.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([hash, files]) => ({
      hash,
      duplicateCount: files.length,
      files,
    }));

  console.log("\n--------------------------------");
  console.log(`Duplicate groups: ${duplicateGroups.length}`);
  console.log("--------------------------------\n");

  if (duplicateGroups.length === 0) {
    console.log("No byte-for-byte duplicate videos found.");
    return;
  }

  for (const [index, group] of duplicateGroups.entries()) {
    console.log(`Duplicate group ${index + 1}`);
    console.log(`SHA-256: ${group.hash}`);

    for (const file of group.files) {
      console.log(`  ${file.filePath} (${file.sizeMb} MB)`);
    }

    console.log("");
  }

  await fs.mkdir("output", { recursive: true });

  const outputPath = path.join("output", "duplicate-videos.json");

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        scannedAt: new Date().toISOString(),
        totalFilesScanned: allFiles.length,
        duplicateGroups,
      },
      null,
      2,
    ),
  );

  console.log(`Results saved to: ${outputPath}`);
}

findDuplicateVideos().catch((error) => {
  console.error("Duplicate scan failed:", error);
  process.exitCode = 1;
});
