const TABLE = "content_discoveries";

export async function getNextDiscovery(supabase, clientId) {
  return supabase
    .from(TABLE)
    .select("*")
    .eq("client_id", clientId)
    .eq("review_status", "pending")
    .order("discovery_score", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function getTotalCount(supabase, clientId) {
  return supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId);
}

export async function getPendingCount(supabase, clientId) {
  return supabase
    .from(TABLE)
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("client_id", clientId)
    .eq("review_status", "pending");
}

export async function getApprovedCount(supabase, clientId) {
  return supabase
    .from(TABLE)
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("client_id", clientId)
    .eq("review_status", "approved");
}

export async function getRejectedCount(supabase, clientId) {
  return supabase
    .from(TABLE)
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("client_id", clientId)
    .eq("review_status", "rejected");
}

export async function reviewYoutubeDiscovery(
  supabase,
  id,
  status,
  archiveCategory,
) {
  const { data: discovery, error } = await supabase
    .from(TABLE)
    .select("client_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error };
  if (!discovery) return { error: { message: "Not Found" } };

  const { data: updated, error: updateError } = await supabase
    .from(TABLE)
    .update({
      review_status: status,
      archive_category: archiveCategory ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");

  if (updateError) return { error: updateError };
  if (updated.length === 0) return { error: { message: "Not allowed" } };

  return { error: null, clientId: discovery.client_id };
}

export async function undoYoutubeReview(supabase, id) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      review_status: "pending",
      archive_category: null,
      reviewed_at: null,
    })
    .eq("id", id)
    .select("id");

  if (error) return { error };
  if (data.length === 0) return { error: { message: "Not found" } };

  return { error: null };
}
