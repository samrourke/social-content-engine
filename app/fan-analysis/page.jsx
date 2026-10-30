import { getFanAnalysisData } from "../../lib/fanAnalysis";
import FanAnalysis from "../../components/FanAnalysis";
import "../globals.css";

// Always query Supabase per request, never serve build-time data
export const dynamic = "force-dynamic";

export default async function FanAnalysisPage() {
  const { engagement, summary } = await getFanAnalysisData();

  return (
    <main>
      <FanAnalysis engagement={engagement} summary={summary} />
    </main>
  );
}
