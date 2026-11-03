// scripts/fanAnalysis/testHikerApi.js
//
// One-off check of the HikerAPI endpoints stage 1 would use, so we can see the
// shape of each response before switching 01_fetchEngagement.js over from Apify.
// Uses 4 requests (100 are free on signup).
//
// Run with:
//   node scripts/fanAnalysis/testHikerApi.js
//
// Each raw response is saved to output/fan-analysis/hiker-test/ for inspection.
// Only field names and counts are printed, not usernames.
//
// Required env vars (add to .env):
//   HIKERAPI_KEY=               from https://hikerapi.com (dashboard → access key)
//   INSTAGRAM_USERNAME=         optional, defaults to "circawaves" (no @)
//
// API reference: https://api.hikerapi.com/docs

import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const HIKER_BASE_URL = "https://api.hikerapi.com";
const OUTPUT_DIR = "output/fan-analysis/hiker-test";

const hikerKey = process.env.HIKERAPI_KEY;
const bandUsername = process.env.INSTAGRAM_USERNAME ?? "circawaves";

if (!hikerKey) throw new Error("Missing HIKERAPI_KEY.");

// Calls a HikerAPI endpoint and returns the parsed JSON.
//
//path - e.g. "/v1/user/by/username"
//params - query string values, e.g. { username: "circawaves" }
//
// Instagram IDs are bigger than JavaScript numbers can hold exactly, so
// safe_int=true asks HikerAPI to send them as strings (on endpoints that support it).

async function hiker(path, params = {}) {
  const url = new URL(path, HIKER_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }

  const response = await fetch(url, { headers: { "x-access-key": hikerKey } });
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function save(name, data) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(`${OUTPUT_DIR}/${name}.json`, JSON.stringify(data, null, 2));
}

// Prints the field names of an object, and what type each one is
function describe(label, value) {
  if (Array.isArray(value)) {
    console.log(`${label}: array of ${value.length}`);
    if (value[0] !== undefined) describe(`${label}[0]`, value[0]);
    return;
  }
  if (value && typeof value === "object") {
    const fields = Object.entries(value).map(([key, v]) =>
      `${key} (${Array.isArray(v) ? `array of ${v.length}` : v === null ? "null" : typeof v})`,
    );
    console.log(`${label}: { ${fields.join(", ")} }`);
    return;
  }
  console.log(`${label}: ${typeof value}`);
}

async function main() {
  // 1. Username → user ID (every other endpoint takes the ID)
  const user = await hiker("/v1/user/by/username", { username: bandUsername });
  save("1-user", user);
  console.log(`@${bandUsername} → user ID ${user.pk}, ${user.follower_count} followers`);

  // 2. One page of recent posts
  const medias = await hiker("/g2/user/medias", { user_id: user.pk });
  save("2-medias", medias);
  describe("medias", medias);
  describe("medias.response", medias.response);

  const posts = Array.isArray(medias.response) ? medias.response : medias.response?.items ?? [];
  const post = posts.find((item) => !item.is_pinned) ?? posts[0];
  if (!post) throw new Error("No posts found — check 2-medias.json for the response shape.");
  console.log(`Test post: ${post.code} (id ${post.id}, pk ${post.pk})`);

  // 3. Likers for that post
  const likers = await hiker("/v2/media/likers", { id: post.id, safe_int: true });
  save("3-likers", likers);
  describe("likers", likers);

  // 4. First page of comments for that post
  const comments = await hiker("/v2/media/comments", { id: post.id, safe_int: true });
  save("4-comments", comments);
  describe("comments", comments);
  describe("comments.response", comments.response);

  console.log(`Raw responses saved to ${OUTPUT_DIR}/`);
}

main().catch((err) => {
  console.error("testHikerApi.js failed:", err.message);
  process.exit(1);
});
