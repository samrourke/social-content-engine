import {
  getInstagramCounts,
  getNextInstagramDiscovery,
} from "../../lib/instagramDiscoveries";
import InstaReviewer from "../../components/InstaReviewer";
import styles from "./page.module.css";
import "../globals.css";

export default async function InstagramReviewPage() {
  const [{ data: discovery, error }, counts] = await Promise.all([
    getNextInstagramDiscovery(),
    getInstagramCounts(),
  ]);

  if (error) {
    return <main className={styles.error}>Error loading discovery: {error.message}</main>;
  }

  return (
    <main>
      <InstaReviewer initialDiscovery={discovery} initialCounts={counts} />
    </main>
  );
}
