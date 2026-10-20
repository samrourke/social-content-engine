import { supabaseAdmin } from "./supabaseAdmin";

const TABLE = "instagram_discoveries";

// Highest-scoring pending post first, newest first within a score. Slides of
// the same carousel share a score and date, so they come up together in order.
export async function getNextInstagramDiscovery() {
  return supabaseAdmin
    .from(TABLE)
    .select("*")
    .eq("review_status", "pending")
    .order("discovery_score", { ascending: false })
    .order("published_at", { ascending: false })
    .order("parent_short_code", { ascending: true })
    .order("slide_number", { ascending: true })
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
// So are split carousels: their slides are counted instead.
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
  const { data: discovery, error } = await supabaseAdmin
    .from(TABLE)
    .select("slide_number")
    .eq("id", id)
    .single();

  if (error) return { error };

  // An approved slide of a split carousel downloads just that slide
  const slides =
    status === "approved" && discovery.slide_number
      ? [discovery.slide_number]
      : carouselSlides;

  return supabaseAdmin
    .from(TABLE)
    .update({
      review_status: status,
      archive_category: archiveCategory ?? null,
      carousel_slides: slides ?? null,
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
