// lib/fanAnalysis.js
//
// Reads the fan analysis output files for the /fan-analysis page. These live in
// output/fan-analysis/ (gitignored), so they only exist where the scripts were
// run: locally this returns data, on Vercel it returns nulls.
//
// Only aggregated totals are returned — the fan files contain usernames, so
// they're summarised here on the server and never passed to the page.

import fs from "node:fs";
import path from "node:path";

const FAN_ANALYSIS_DIR = path.join(process.cwd(), "output/fan-analysis");

function latestFile(prefix) {
  if (!fs.existsSync(FAN_ANALYSIS_DIR)) return null;

  return (
    fs
      .readdirSync(FAN_ANALYSIS_DIR)
      .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
      .sort()
      .at(-1) ?? null
  );
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(FAN_ANALYSIS_DIR, file), "utf8"));
}

// "ig-summary-2026-10-28T14-44-41-485Z.json" → Date
function dateFromFilename(file, prefix) {
  const stamp = file.replace(prefix, "").replace(".json", "");
  const iso = stamp.replace(/T(\d+)-(\d+)-(\d+)-(\d+)Z$/, "T$1:$2:$3.$4Z");
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Stage 1–2 totals: how big and how loyal the engaged audience is
function getEngagementStats() {
  const fansFile = latestFile("ig-fans-");
  if (!fansFile) return null;

  const fans = readJson(fansFile);

  // The raw scrape with the same timestamp says how many posts were analysed
  const rawFile = fansFile.replace("ig-fans-", "ig-engagement-raw-");
  const posts = fs.existsSync(path.join(FAN_ANALYSIS_DIR, rawFile))
    ? readJson(rawFile).posts
    : [];

  const postCount = posts.length || Math.max(0, ...fans.map((fan) => fan.postsEngaged));
  const postDates = posts.map((post) => post.timestamp).filter(Boolean).sort();

  return {
    scrapedAt: dateFromFilename(fansFile, "ig-fans-"),
    postCount,
    firstPostDate: postDates[0] ?? null,
    lastPostDate: postDates.at(-1) ?? null,
    totalFans: fans.length,
    privateFans: fans.filter((fan) => fan.is_private).length,
    commenters: fans.filter((fan) => fan.postsCommented.length > 0).length,
    repeatFans: fans.filter((fan) => fan.postsEngaged >= 2).length,
    superfans: fans.filter((fan) => fan.postsEngaged === postCount).length,
    eligibleFans: fans.filter(
      (fan) => !fan.is_private && !fan.is_verified && fan.postsEngaged >= 2,
    ).length,
  };
}

function getSummary() {
  const summaryFile = latestFile("ig-summary-");
  if (!summaryFile) return null;

  return {
    ...readJson(summaryFile),
    generatedFrom: dateFromFilename(summaryFile, "ig-summary-"),
  };
}

export function getFanAnalysisData() {
  try {
    return { engagement: getEngagementStats(), summary: getSummary() };
  } catch (err) {
    console.error("Failed to read fan analysis files:", err.message);
    return { engagement: null, summary: null };
  }
}
