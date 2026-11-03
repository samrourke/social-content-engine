// lib/fanAnalysis.js
//
// Loads the newest fan analysis for the /fan-analysis page from the fan_analysis
// table, written by scripts/fanAnalysis/06_summarise.js. Rows hold aggregated
// results only — no fan usernames or IDs.

import { supabaseAdmin } from "./supabaseAdmin";

const ARTIST = process.env.INSTAGRAM_USERNAME ?? "circawaves";
const PLATFORM = "instagram";

export async function getFanAnalysisData() {
  const { data, error } = await supabaseAdmin
    .from("fan_analysis")
    .select("summary, engagement, created_at")
    .eq("artist", ARTIST)
    .eq("platform", PLATFORM)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load fan analysis:", error.message);
    return { engagement: null, summary: null };
  }

  return {
    engagement: data?.engagement ?? null,
    summary: data ? { ...data.summary, generatedFrom: data.created_at } : null,
  };
}
