import { supabaseAdmin } from "./supabaseAdmin";

const TABLE = "instagram_discoveries";

// Highest-scoring pending post first, newest first within a score.
export async function getNextInstagramDiscovery() {
  return supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("review_status", "pending")
    .order("discovery_score", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function countByStatus(status) {
  const { count, error } = await supabaseAdmin
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("review_status", status);

  if (error) throw error;

  return count ?? 0;
}

// auto_rejected posts are excluded from the review total — they never reach the queue.
export async function getInstagramCounts() {
  const [pending, approved, rejected, autoRejected] = await Promise.all([
    countByStatus("pending"),
    countByStatus("approved"),
    countByStatus("rejected"),
    countByStatus("auto_rejected"),
  ]);

  return {
    total: pending + approved + rejected,
    pending,
    approved,
    rejected,
    autoRejected,
  };
}

export async function reviewInstagramDiscovery(
  id,
  status,
  archiveCategory,
  carouselSlides,
) {
  return supabaseAdmin
    .from(TABLE)
    .update({
      review_status: status,
      archive_category: archiveCategory ?? null,
      carousel_slides: carouselSlides ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function undoInstagramReview(id) {
  return supabaseAdmin
    .from(TABLE)
    .update({
      review_status: "pending",
      archive_category: null,
      carousel_slides: null,
      reviewed_at: null,
    })
    .eq("id", id);
}
