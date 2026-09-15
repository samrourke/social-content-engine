import { getTiktokDashboardData } from "../../lib/tiktokStats";
import TiktokDashboard from "../../components/TiktokDashboard";
import "../globals.css";

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
