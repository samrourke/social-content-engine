import { getTiktokDashboardData } from "../../lib/tiktokStats";
import TiktokDashboard from "../../components/TiktokDashboard";
import "../globals.css";

// Always query Supabase per request, never serve build-time data
export const dynamic = "force-dynamic";

export default async function TiktokDashboardPage() {
  const { latestSnapshot, firstSnapshot, videos, pillars } =
    await getTiktokDashboardData();

  return (
    <main>
      <TiktokDashboard
        latestSnapshot={latestSnapshot}
        firstSnapshot={firstSnapshot}
        videos={videos}
        pillars={pillars}
      />
    </main>
  );
}
