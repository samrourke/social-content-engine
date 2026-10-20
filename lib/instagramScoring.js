// lib/instagramScoring.js
//
// Relevance filter and ranking for Instagram posts scraped by
// scripts/instagramSearch.js. Kept separate so the rules can be backtested
// against past review decisions without running the scraper.
//
// The score ranks the review queue (highest first): it estimates how likely a
// post is to be footage of Circa Waves, not how popular it is.

export const BAND_PATTERN = /circa\s*waves/i;

const BAND_HANDLE = "circawaves";

// Words suggesting the post is footage of the band rather than a track used as a soundtrack.
const LIVE_KEYWORDS = [
  "live",
  "livemusic",
  "gig",
  "concert",
  "tour",
  "setlist",
  "front row",
  "frontrow",
  "encore",
  "moshpit",
  "mosh",
  "interview",
  "backstage",
  "acoustic",
  "session",
  "soundcheck",
  "signing",
  "meet and greet",
];

// Song titles distinctive enough that a caption naming one is probably about
// Circa Waves (generic titles like "Movies" or "Wake Up" are left out).
const SONGS = [
  "t-shirt weather",
  "tshirt weather",
  "stuck in my teeth",
  "fossils",
  "get away",
  "young chasers",
  "move to san francisco",
  "fire that burns",
  "times won't change me",
  "hell on earth",
  "sad happy",
  "jacqueline",
  "do you wanna talk",
  "carry you home",
  "living in the grey",
  "we made it",
  "old balloons",
  "stick around",
  "cherry bomb",
  "want it all today",
  "me, myself and hollywood",
  "death & love",
  "death and love",
];

// Adverts, releases and recommendations: about the band, but not footage of them.
const PROMO_PATTERN =
  /\b(tickets?|on sale|out now|pre-?save|presale|stream(ing)? (it|now|on)|link in (my )?bio|new music|album review|giveaway|competition|playlist|headline tour|announce)/i;

// Year-in-review and gig-count compilations, where Circa Waves is one act of many.
const RECAP_PATTERN =
  /\b(recap|wrapped|\d+ (gigs|concerts|shows|artists)|year in (gigs|concerts|music))\b/i;

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

function captionWithoutHashtags(item) {
  return (item.caption ?? "").replace(/#\S+/g, " ");
}

// First line with some prose in it, minus any hashtags trailing after the prose.
// Hashtags used as words in a sentence ("#circawaves en live Paris") still count.
function firstLine(item) {
  const line = (item.caption ?? "")
    .split("\n")
    .map((text) => text.trim())
    .find((text) => /\p{L}/u.test(text.replace(/#\S+/g, ""))) ?? "";

  return line.replace(/(\s+#\S+)+\s*$/, "");
}

export function findLiveKeyword(item) {
  const caption = (item.caption ?? "").toLowerCase();
  const hashtags = (item.hashtags ?? []).map((tag) => tag.toLowerCase());

  return LIVE_KEYWORDS.find((keyword) => {
    if (new RegExp(`\\b${keyword}s?\\b`).test(caption)) return true;

    // Only trust compound hashtags that also name the band, e.g. #circawaveslive
    // (plain substring matching would treat #liverpool as "live").
    const compact = keyword.replace(/\s/g, "");
    return hashtags.some((tag) => BAND_PATTERN.test(tag) && tag.includes(compact));
  });
}

function handles(post) {
  return [
    ...(post.mentions ?? []),
    ...(post.taggedUsers ?? []).map((user) => user.username),
    ...(post.coauthorProducers ?? []).map((user) => user.username),
  ].map((handle) => handle?.toLowerCase());
}

export function tagsBand(item) {
  return handles(item).includes(BAND_HANDLE) || /@circawaves\b/i.test(item.caption ?? "");
}

export function mentionsBand(item) {
  const text = [item.caption, ...(item.hashtags ?? []), item.ownerUsername].join(" ");

  return BAND_PATTERN.test(text) || tagsBand(item);
}

function findSong(item) {
  const caption = (item.caption ?? "").toLowerCase().replace(/[’']/g, "'");
  return SONGS.find((song) => caption.includes(song));
}

// Carousels ("Sidecar" posts) can mix photos and videos; count the videos inside.
export function countVideos(item) {
  if (item.type === "Video" || item.productType === "clips") return 1;
  return (item.childPosts ?? []).filter((child) => child.type === "Video").length;
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

// Returns { status, reason, score, reasons, keyword }. `reasons` lists what
// moved the score, so the reviewer can see why a post ranked where it did.
export function assessRelevance(item, search) {
  const music = item.musicInfo ?? null;
  const usesLibraryTrack = music?.uses_original_audio === false;
  const keyword = findLiveKeyword(item);

  const reject = (reason) => ({
    status: "auto_rejected",
    reason,
    score: 0,
    reasons: [],
    keyword,
  });

  if (countVideos(item) === 0) return reject("Not a video");

  if (!mentionsBand(item)) return reject("No mention of Circa Waves");

  if (usesLibraryTrack && !keyword && !search.trusted) {
    return reject(`Background music only (${music.artist_name} - ${music.song_name})`);
  }

  let score = 40;
  const reasons = [];
  const adjust = (points, reason) => {
    score += points;
    reasons.push(`${points > 0 ? "+" : ""}${points} ${reason}`);
  };

  const opening = firstLine(item);
  if (BAND_PATTERN.test(opening) || /@circawaves\b/i.test(opening)) {
    adjust(20, "named in first line");
  } else if (BAND_PATTERN.test(captionWithoutHashtags(item))) {
    adjust(10, "named in caption");
  }

  const song = findSong(item);
  if (song) adjust(15, `song "${song}"`);

  if (keyword) adjust(15, `"${keyword}"`);

  if (tagsBand(item)) adjust(5, "tags @circawaves");

  const hashtagCount = (item.hashtags ?? []).length;
  if (hashtagCount >= 15) adjust(-25, `${hashtagCount} hashtags`);
  else if (hashtagCount >= 8) adjust(-10, `${hashtagCount} hashtags`);

  if (PROMO_PATTERN.test(item.caption ?? "")) adjust(-25, "promo wording");

  if (RECAP_PATTERN.test(item.caption ?? "")) adjust(-15, "recap/compilation");

  // Only trusted accounts reach here with a library track: on the band's own
  // feed that's almost always a promo edit.
  if (usesLibraryTrack) adjust(-25, `library track (${music.song_name})`);

  if (search.trusted && item.ownerUsername?.toLowerCase() !== BAND_HANDLE) {
    adjust(-15, `posted by @${item.ownerUsername}`);
  }

  return {
    status: "pending",
    reason: null,
    score: clamp(score),
    reasons,
    keyword,
  };
}

// Adjusts a carousel's assessment for one of its video slides.
export function assessSlide(postAssessment, child) {
  let score = postAssessment.score;
  const reasons = [...postAssessment.reasons];

  if (handles(child).includes(BAND_HANDLE)) {
    score += 15;
    reasons.push("+15 slide tags @circawaves");
  }

  if ((child.videoDuration ?? 0) > 0 && child.videoDuration < 5) {
    score -= 20;
    reasons.push(`-20 ${Math.round(child.videoDuration)}s clip`);
  }

  return { ...postAssessment, score: clamp(score), reasons };
}

function clamp(score) {
  return Math.max(0, Math.min(100, score));
}

export function classifyContent(caption = "") {
  const text = (caption ?? "").toLowerCase();

  if (text.includes("interview") || text.includes("chat") || text.includes("talks to")) {
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

  if (text.includes("live") || text.includes("concert") || text.includes("gig")) {
    return "Live Performance";
  }

  return "Unknown";
}
