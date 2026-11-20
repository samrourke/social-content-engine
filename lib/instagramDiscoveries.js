const TABLE = "instagram_discoveries";

// Highest-scoring pending post first, newest first within a score. Slides of
// the same carousel share a score and date, so they come up together in order.
export async function getNextInstagramDiscovery(supabase, clientId) {
  return supabase
    .from(TABLE)
    .select("*")
    .eq("review_status", "pending")
    .eq("client_id", clientId)
    .order("discovery_score", { ascending: false })
    .order("published_at", { ascending: false })
    .order("parent_short_code", { ascending: true })
    .order("slide_number", { ascending: true })
    .limit(1)
    .maybeSingle();
}

async function countByStatus(supabase, clientId, status) {
  const { count, error } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("review_status", status);

  if (error) throw error;

  return count ?? 0;
}

// auto_rejected posts are excluded from the review total — they never reach the queue.
// So are split carousels: their slides are counted instead.
export async function getInstagramCounts(supabase, clientId) {
  const [pending, approved, rejected, autoRejected] = await Promise.all([
    countByStatus(supabase, clientId, "pending"),
    countByStatus(supabase, clientId, "approved"),
    countByStatus(supabase, clientId, "rejected"),
    countByStatus(supabase, clientId, "auto_rejected"),
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
  supabase,
  id,
  status,
  archiveCategory,
  carouselSlides,
) {
  const { data: discovery, error } = await supabase
    .from(TABLE)
    .select("slide_number, client_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error };
  if (!discovery) return { error: { message: "Not Found" } };

  // An approved slide of a split carousel downloads just that slide
  const slides =
    status === "approved" && discovery.slide_number
      ? [discovery.slide_number]
      : carouselSlides;

  const { data: updated, error: updateError } = await supabase
    .from(TABLE)
    .update({
      review_status: status,
      archive_category: archiveCategory ?? null,
      carousel_slides: slides ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (updateError) return { error: updateError };
  if (updated.length === 0) return { error: { message: "Not allowed" } };

  return { error: null, clientId: discovery.client_id };
}

export async function undoInstagramReview(supabase, id) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      review_status: "pending",
      archive_category: null,
      carousel_slides: null,
      reviewed_at: null,
    })
    .eq("id", id)
    .select("id");

  if (error) return { error };
  if (data.length === 0) return { error: { message: "Not found" } };

  return { error: null };
}
