import {
  getInstagramCounts,
  getNextInstagramDiscovery,
} from "@/lib/instagramDiscoveries";
import InstaReviewer from "@/components/InstaReviewer";
import styles from "./page.module.css";
import "@/app/globals.css";
import { requireClient } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";

// Always query Supabase per request, never serve build-time data
export const dynamic = "force-dynamic";

export default async function InstagramReviewPage({ params }) {
  const { client: slug } = await params;
  const { client, isAdmin } = await requireClient(slug);
  const supabase = await createClient();

  const [{ data: discovery, error }, counts] = await Promise.all([
    getNextInstagramDiscovery(supabase, client.id),
    getInstagramCounts(supabase, client.id),
  ]);

  if (error) {
    return (
      <main className={styles.error}>
        Error loading discovery: {error.message}
      </main>
    );
  }

  return (
    <main>
      <InstaReviewer initialDiscovery={discovery} initialCounts={counts} />
    </main>
  );
}
