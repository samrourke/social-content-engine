import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DRY_RUN = false; // Set to true to prevent actual inserts, for testing

async function getExistingUrls() {
  const { data, error } = await supabase
    .from("circa_full_content")
    .select("normalised_source_url");

  if (error) {
    throw error;
  }

  return new Set(data.map((row) => row.normalised_source_url).filter(Boolean));
}

async function getApprovedDiscoveries() {
  const { data, error } = await supabase
    .from("content_discoveries")
    .select("*")
    .eq("review_status", "approved")
    .is("imported_at", null);

  if (error) {
    throw error;
  }

  return data;
}

function discoveryToFullContent(discovery) {
  return {
    title: discovery.title,

    source_url: discovery.source_url,

    normalised_source_url: discovery.normalised_source_url,

    source_location: null,

    description: discovery.description,

    archive_category: discovery.archive_category,

    processing_status: "pending",

    updated_at: new Date().toISOString(),
  };
}

async function importDiscoveries() {
  console.log("Checking approved discoveries...\n");

  const existingUrls = await getExistingUrls();
  const discoveries = await getApprovedDiscoveries();

  console.log(`${discoveries.length} approved discoveries found.`);

  console.log(`${existingUrls.size} existing URLs in circa_full_content.\n`);

  const duplicates = [];
  const newDiscoveries = [];

  for (const discovery of discoveries) {
    const url = discovery.normalised_source_url;

    if (!url) {
      console.log(`Skipping — no normalised URL: ${discovery.title}`);
      continue;
    }

    if (existingUrls.has(url)) {
      duplicates.push(discovery);
      continue;
    }

    newDiscoveries.push(discovery);

    // Protect against duplicates within this import batch too
    existingUrls.add(url);
  }

  console.log("RESULTS");
  console.log("-------");
  console.log(`${discoveries.length} approved`);
  console.log(`${duplicates.length} already in full content`);
  console.log(`${newDiscoveries.length} ready to import`);

  if (duplicates.length > 0) {
    console.log("\nDUPLICATES:");

    for (const duplicate of duplicates) {
      console.log(`- ${duplicate.title}`);
    }
  }

  if (DRY_RUN) {
    console.log("\nDRY RUN — nothing has been inserted.");

    console.log("Set DRY_RUN = false when you're happy.");

    return;
  }

  if (newDiscoveries.length === 0) {
    console.log("\nNothing new to import.");
    return;
  }

  const rows = newDiscoveries.map(discoveryToFullContent);

  console.log("\nSample rows to import:");
  console.log(rows.slice(0, 5));

  const { data, error } = await supabase
    .from("circa_full_content")
    .insert(rows)
    .select("id, title, normalised_source_url");

  if (error) {
    throw error;
  }

  console.log(`\nSuccessfully imported ${data.length} discoveries.`);

  // Mark the discoveries we just imported
  const importedDiscoveryIds = newDiscoveries.map((discovery) => discovery.id);

  const { error: markImportedError } = await supabase
    .from("content_discoveries")
    .update({
      imported_at: new Date().toISOString(),
    })
    .in("id", importedDiscoveryIds);

  if (markImportedError) {
    throw markImportedError;
  }

  console.log(`Marked ${importedDiscoveryIds.length} discoveries as imported.`);
}

importDiscoveries().catch((error) => {
  console.error("Import failed:", error);
  process.exitCode = 1;
});
