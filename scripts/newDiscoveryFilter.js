import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function removeExistingDiscoveries() {
  const { data: fullContent, error: fullContentError } = await supabase
    .from("circa_full_content")
    .select("normalised_source_url");

  if (fullContentError) {
    throw fullContentError;
  }

  const existingUrls = new Set(
    fullContent.map((row) => row.normalised_source_url).filter(Boolean),
  );

  const { data: discoveries, error: discoveriesError } = await supabase
    .from("content_discoveries")
    .select("id, source_url, title");

  if (discoveriesError) {
    throw discoveriesError;
  }

  const duplicates = discoveries.filter((row) =>
    existingUrls.has(row.source_url),
  );

  console.log(
    `Found ${duplicates.length} discoveries already in circa_full_content.`,
  );

  if (duplicates.length === 0) {
    return;
  }

  const duplicateIds = duplicates.map((row) => row.id);

  const { error: deleteError } = await supabase
    .from("content_discoveries")
    .delete()
    .in("id", duplicateIds);

  if (deleteError) {
    throw deleteError;
  }

  console.log(`Deleted ${duplicates.length} duplicate discoveries.`);
}

removeExistingDiscoveries().catch((error) => {
  console.error("Cleanup failed:", error);
  process.exitCode = 1;
});
