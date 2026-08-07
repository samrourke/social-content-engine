import { supabaseAdmin } from "../lib/supabaseAdmin";
import DiscoveryReviewer from "../components/DiscoveryReviewer";
import styles from "./page.module.css";
import "./globals.css";

export default async function ContentReviewPage() {
  const [
    { data: discovery, error },
    { count: totalCount },
    { count: pendingCount },
    { count: approvedCount },
    { count: rejectedCount },
  ] = await Promise.all([
    supabaseAdmin
      .from("content_discoveries")
      .select("*")
      .eq("review_status", "pending")
      .order("discovery_score", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabaseAdmin.from("content_discoveries").select("*", {
      count: "exact",
      head: true,
    }),

    supabaseAdmin
      .from("content_discoveries")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("review_status", "pending"),

    supabaseAdmin
      .from("content_discoveries")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("review_status", "approved"),

    supabaseAdmin
      .from("content_discoveries")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("review_status", "rejected"),
  ]);

  if (error) {
    return <main>Error loading discovery: {error.message}</main>;
  }

  return (
    <main>
      <DiscoveryReviewer
        initialDiscovery={discovery}
        initialCounts={{
          total: totalCount ?? 0,
          pending: pendingCount ?? 0,
          approved: approvedCount ?? 0,
          rejected: rejectedCount ?? 0,
        }}
      />
    </main>
  );
}
