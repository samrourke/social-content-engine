import { getFanAnalysisData } from "../../lib/fanAnalysis";
import FanAnalysis from "../../components/FanAnalysis";
import "../globals.css";

// Read the latest output files per request, never serve build-time data
export const dynamic = "force-dynamic";

export default function FanAnalysisPage() {
  const { engagement, summary } = getFanAnalysisData();

  return (
    <main>
      <FanAnalysis engagement={engagement} summary={summary} />
    </main>
  );
}
