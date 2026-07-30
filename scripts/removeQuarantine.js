import fs from "fs/promises";
import path from "path";

const QUARANTINE_DIR = "output/orphaned-duplicates";

const CONFIRM_DELETE = process.argv.includes("--delete");

async function removeDirectoryContents(directory) {
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await removeDirectoryContents(fullPath);
      await fs.rmdir(fullPath);
    } else {
      await fs.unlink(fullPath);
    }
  }
}

async function main() {
  if (!CONFIRM_DELETE) {
    console.log(
      "Dry run. Pass --delete to permanently remove the quarantine files.",
    );
    return;
  }

  try {
    await removeDirectoryContents(QUARANTINE_DIR);
    console.log("Quarantine folder emptied.");
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("Quarantine folder does not exist.");
      return;
    }

    throw error;
  }
}

main().catch(console.error);
