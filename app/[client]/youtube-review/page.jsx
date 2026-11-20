import DiscoveryReviewer from "@/components/DiscoveryReviewer";
import styles from "./page.module.css";
import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/tenant";
import "@/app/globals.css";
import {
  getNextDiscovery,
  getTotalCount,
  getPendingCount,
  getApprovedCount,
  getRejectedCount,
} from "@/lib/youtubeDiscoveries";

// Always query Supabase per request, never serve build-time data
export const dynamic = "force-dynamic";

export default async function ContentReviewPage({ params }) {
  const { client: slug } = await params;

  const { client, isAdmin } = await requireClient(slug);
  const supabase = await createClient();

  const [
    { data: discovery, error },
    { count: totals },
    { count: pending },
    { count: approved },
    { count: rejected },
  ] = await Promise.all([
    getNextDiscovery(supabase, client.id),
    getTotalCount(supabase, client.id),
    getPendingCount(supabase, client.id),
    getApprovedCount(supabase, client.id),
    getRejectedCount(supabase, client.id),
  ]);

  if (error) {
    return <main>Error loading discovery: {error.message}</main>;
  }

  return (
    <main>
      <DiscoveryReviewer
        initialDiscovery={discovery}
        initialCounts={{
          total: totals ?? 0,
          pending: pending ?? 0,
          approved: approved ?? 0,
          rejected: rejected ?? 0,
        }}
      />
    </main>
  );
}
