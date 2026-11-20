import { requireClient } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getTiktokDashboardData } from "../../../lib/tiktokStats";
import TiktokDashboard from "../../../components/TiktokDashboard";
import "../../globals.css";

// Always query Supabase per request, never serve build-time data
export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }) {
  const { client: slug } = await params;
  const { client, isAdmin } = await requireClient(slug);
  const supabase = await createClient();

  const { latestSnapshot, firstSnapshot, videos, pillars } =
    await getTiktokDashboardData(supabase, client.id);

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
