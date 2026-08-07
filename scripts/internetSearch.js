import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const youtubeApiKey = process.env.YOUTUBE_API_KEY;

if (!supabaseUrl || !serviceRoleKey || !youtubeApiKey) {
  throw new Error("Missing Supabase credentials or YOUTUBE_API_KEY.");
}

console.log("RUNNING UPDATED INTERNET SEARCH SCRIPT");

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function getSearchState(query) {
  const { data, error } = await supabase
    .from("discovery_search_state")
    .select("*")
    .eq("query", query)
    .maybeSingle();

  if (error) throw error;

  return data;
}

const SEARCH_QUERIES = [
  "Circa Waves",
  '"Circa Waves" interview',
  '"Circa Waves" live',
  '"Circa Waves" backstage',
  '"Circa Waves" festival',
  '"Circa Waves" acoustic',
  '"Circa Waves" session',
  '"Circa Waves" BBC',
  '"Circa Waves" NME',
  '"Circa Waves" Radio X',
];

function classifyContent(title = "", description = "") {
  const text = `${title} ${description}`.toLowerCase();

  if (
    text.includes("interview") ||
    text.includes("chat") ||
    text.includes("talks to")
  ) {
    return "Interview";
  }

  if (text.includes("backstage") || text.includes("behind the scenes")) {
    return "Backstage";
  }

  if (text.includes("acoustic") || text.includes("session")) {
    return "Studio Session";
  }

  if (
    text.includes("festival") ||
    text.includes("glastonbury") ||
    text.includes("reading festival") ||
    text.includes("leeds festival")
  ) {
    return "Festival";
  }

  if (
    text.includes("live") ||
    text.includes("concert") ||
    text.includes("gig")
  ) {
    return "Live Performance";
  }

  if (text.includes("official video") || text.includes("music video")) {
    return "Music Video";
  }

  return "Unknown";
}

function calculateDiscoveryScore(video, query) {
  const title = video.snippet.title.toLowerCase();
  const description = video.snippet.description.toLowerCase();
  const channel = video.snippet.channelTitle.toLowerCase();
  const combined = `${title} ${description}`;

  let score = 0;

  if (title.includes("circa waves")) score += 40;
  if (combined.includes("circa waves")) score += 20;

  if (
    combined.includes("interview") ||
    combined.includes("backstage") ||
    combined.includes("live") ||
    combined.includes("session") ||
    combined.includes("festival")
  ) {
    score += 15;
  }

  if (query.toLowerCase().includes("circa waves")) {
    score += 5;
  }

  if (channel.includes("circa waves")) {
    score += 10;
  }

  return Math.min(score, 100);
}

function normaliseYouTubeUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    let videoId = null;

    if (parsed.hostname === "youtu.be" || parsed.hostname === "www.youtu.be") {
      videoId = parsed.pathname.split("/")[1];
    }

    if (parsed.hostname.includes("youtube.com")) {
      videoId = parsed.searchParams.get("v");
    }

    if (!videoId) {
      return null;
    }

    return `https://www.youtube.com/watch?v=${videoId}`;
  } catch {
    return null;
  }
}

async function getExistingSourceUrls() {
  const { data, error } = await supabase
    .from("circa_full_content")
    .select("normalised_source_url");

  if (error) {
    throw error;
  }

  return new Set(data.map((row) => row.normalised_source_url).filter(Boolean));
}

async function searchYouTube(query, maxPages = 3, startingPageToken = null) {
  let pageToken = startingPageToken;
  const results = [];

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: "50",
      key: youtubeApiKey,
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message ??
          `YouTube API request failed with ${response.status}`,
      );
    }

    results.push(...(data.items ?? []));

    if (!data.nextPageToken) {
      return {
        results,
        nextPageToken: null,
      };
    }

    pageToken = data.nextPageToken;
  }

  return {
    results,
    nextPageToken: pageToken,
  };
}

function isRelevantResult(video) {
  const title = video.snippet.title.toLowerCase();
  const description = video.snippet.description.toLowerCase();
  const channel = video.snippet.channelTitle.toLowerCase();

  const text = `${title} ${description} ${channel}`;

  return text.includes("circa waves") || text.includes("circawaves");
}

async function discoveryAlreadyExists(videoId, sourceUrl) {
  const { data, error } = await supabase
    .from("content_discoveries")
    .select("id")
    .or(`platform_video_id.eq.${videoId},source_url.eq.${sourceUrl}`)
    .limit(1);

  if (error) {
    throw error;
  }

  return data.length > 0;
}

async function saveDiscovery(video, query, normalisedSourceUrl) {
  const videoId = video.id.videoId;

  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const snippet = video.snippet;

  const exists = await discoveryAlreadyExists(videoId, sourceUrl);

  if (exists) {
    console.log(`Already discovered: ${snippet.title}`);

    return false;
  }

  const contentType = classifyContent(snippet.title, snippet.description);

  const discoveryScore = calculateDiscoveryScore(video, query);

  const { error } = await supabase.from("content_discoveries").insert({
    platform: "youtube",
    platform_video_id: videoId,
    title: snippet.title,
    description: snippet.description,
    source_url: sourceUrl,
    normalised_source_url: normalisedSourceUrl,
    channel_name: snippet.channelTitle,
    channel_id: snippet.channelId,
    published_at: snippet.publishedAt,
    thumbnail_url:
      snippet.thumbnails?.high?.url ??
      snippet.thumbnails?.medium?.url ??
      snippet.thumbnails?.default?.url ??
      null,
    search_query: query,
    discovery_score: discoveryScore,
    suggested_content_type: contentType,
    review_status: "pending",
  });

  if (error) {
    throw error;
  }

  console.log(`Added: ${snippet.title} (${discoveryScore}/100)`);

  return true;
}

async function runDiscovery() {
  let addedCount = 0;

  const seenVideoIds = new Set();
  const existingSourceUrls = await getExistingSourceUrls();

  console.log(
    `Found ${existingSourceUrls.size} existing source URLs in main library.`,
  );

  for (const query of SEARCH_QUERIES) {
    console.log(`\nSearching: ${query}`);

    try {
      // 1. Get saved pagination state for this query
      const state = await getSearchState(query);

      if (state?.completed) {
        console.log(`Search already completed: ${query}`);
        continue;
      }

      const startingPageToken = state?.next_page_token ?? null;

      console.log(`Starting from page ${state?.pages_searched ?? 0 + 1}`);

      // 2. Continue from saved page token
      const { results: videos, nextPageToken } = await searchYouTube(
        query,
        3,
        startingPageToken,
      );

      console.log(`Found ${videos.length} results`);

      // 3. Process videos
      for (const video of videos) {
        const videoId = video.id.videoId;

        if (seenVideoIds.has(videoId)) {
          console.log(`Duplicate in this run: ${video.snippet.title}`);
          continue;
        }

        if (!isRelevantResult(video)) {
          console.log(`Not relevant: ${video.snippet.title}`);
          continue;
        }

        seenVideoIds.add(videoId);

        const normalisedSourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

        if (existingSourceUrls.has(normalisedSourceUrl)) {
          console.log(`Already in full content: ${video.snippet.title}`);
          continue;
        }

        try {
          const added = await saveDiscovery(video, query, normalisedSourceUrl);

          if (added) {
            addedCount++;
          }
        } catch (error) {
          console.error(
            `Could not save "${video.snippet?.title}":`,
            error.message,
          );
        }
      }

      // 4. Save where this query got to
      const previousPages = state?.pages_searched ?? 0;

      await supabase.from("discovery_search_state").upsert({
        query,
        next_page_token: nextPageToken,
        pages_searched: (state?.pages_searched ?? 0) + 3,
        completed: nextPageToken === null,
        updated_at: new Date().toISOString(),
      });

      console.log(`Saved search progress for: ${query}`);
    } catch (error) {
      console.error(`Search failed for "${query}":`, error.message);
    }
  }

  console.log(`\nDiscovery complete.`);
  console.log(`${seenVideoIds.size} unique YouTube videos examined.`);
  console.log(`${addedCount} new candidates added.`);
}

runDiscovery().catch((error) => {
  console.error("Discovery script failed:", error);

  process.exitCode = 1;
});
