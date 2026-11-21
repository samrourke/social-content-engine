import { getFanAnalysisData } from "@/lib/fanAnalysis";
import FanAnalysis from "@/components/FanAnalysis";
import "@/app/globals.css";
import { requireClient } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";

// Always query Supabase per request, never serve build-time data
export const dynamic = "force-dynamic";

export default async function FanAnalysisPage({ params }) {
  const { client: slug } = await params;
  const { client, isAdmin } = await requireClient(slug);
  const supabase = await createClient();
  const { engagement, summary } = await getFanAnalysisData(supabase, client.id);

  return (
    <main>
      <FanAnalysis engagement={engagement} summary={summary} />
    </main>
  );
}
