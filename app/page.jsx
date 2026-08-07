import { supabaseAdmin } from "../lib/supabaseAdmin";
import DiscoveryReviewer from "../components/DiscoveryReviewer";
import styles from "./page.module.css";

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
    return (
      <main>
        <header className={styles.progress}>
          <h1 className={styles.progressTitle}>Content Review</h1>

          <p className={styles.progressRemaining}>
            {counts.pending} videos left to review
          </p>

          <p className={styles.progressStats}>
            {counts.approved} approved · {counts.rejected} rejected ·{" "}
            {counts.total} total
          </p>

          <div className={styles.progressDetails}>
            <span>
              {reviewed} / {counts.total} reviewed
            </span>

            <span>{progress}%</span>
          </div>

          <progress
            className={styles.progressBar}
            value={reviewed}
            max={counts.total}
          />
        </header>
        Error loading discovery: {error.message}
      </main>
    );
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
