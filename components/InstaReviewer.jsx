"use client";

import { useState } from "react";
import styles from "./InstaReviewer.module.css";

const CATEGORIES = [
  "Interview",
  "Professional Live",
  "Fan Live",
  "Backstage / Tour",
  "Studio / Acoustic",
  "Official / Promo",
  "Other",
];

function formatNumber(value) {
  return value == null ? "—" : Number(value).toLocaleString("en-GB");
}

function describeAudio(discovery) {
  if (discovery.uses_original_audio === true) return "Original audio";

  if (discovery.uses_original_audio === false) {
    return `${discovery.music_artist} – ${discovery.music_song}`;
  }

  return "Unknown (carousel)";
}

// Instagram CDN links carry their expiry as a hex Unix timestamp in "oe".
function videoLinkExpiry(url) {
  const oe = url && new URL(url).searchParams.get("oe");
  return oe ? new Date(parseInt(oe, 16) * 1000) : null;
}

const REFRESH_COMMAND = "node scripts/instagramSearch.js --refresh";

// Plays a carousel slide's video file directly (Instagram's embed can't open at
// a given slide). The link expires a few days after the scrape.
function SlideVideo({ discovery }) {
  const [failed, setFailed] = useState(false);
  const expiry = videoLinkExpiry(discovery.video_url);
  const expired = failed || (expiry && expiry < new Date());

  if (expired) {
    return (
      <div className={styles.videoExpired}>
        <p>This video link has expired.</p>
        <p>
          Renew the links with <code>{REFRESH_COMMAND}</code>, or watch it on
          Instagram.
        </p>
        <a href={discovery.source_url} target="_blank" rel="noreferrer">
          Open slide {discovery.slide_number ?? ""} on Instagram ↗
        </a>
      </div>
    );
  }

  return (
    <video
      key={discovery.id}
      className={styles.video}
      src={discovery.video_url}
      poster={discovery.thumbnail_url ?? undefined}
      onError={() => setFailed(true)}
      controls
      autoPlay
      playsInline
    />
  );
}

// Parses "17, 19" or "17-19" into [17, 19] / [17, 18, 19].
// Returns null for blank input (keep every video) and false if anything is invalid.
function parseSlides(input) {
  const tokens = input.split(/[,\s]+/).filter(Boolean);

  if (tokens.length === 0) return null;

  const slides = new Set();

  for (const token of tokens) {
    const match = token.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) return false;

    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start) return false;

    for (let slide = start; slide <= end; slide++) slides.add(slide);
  }

  return [...slides].sort((a, b) => a - b);
}

export default function InstaReviewer({ initialDiscovery, initialCounts }) {
  const [discovery, setDiscovery] = useState(initialDiscovery);
  const [lastReviewed, setLastReviewed] = useState(null);
  const [slidesInput, setSlidesInput] = useState("");

  // Slides of a split carousel are reviewed one at a time, so only a carousel
  // reviewed as a whole needs the slide picker.
  const isSlide = Boolean(discovery?.slide_number);
  const isCarousel = Array.isArray(discovery?.carousel_video_slides) && !isSlide;
  const carouselSlides = isCarousel ? parseSlides(slidesInput) : null;
  const slidesInvalid = carouselSlides === false;

  const [counts, setCounts] = useState(initialCounts);

  const reviewed = counts.approved + counts.rejected;

  const progress =
    counts.total > 0 ? Math.round((reviewed / counts.total) * 100) : 0;

  async function review(status, archiveCategory = null) {
    const currentDiscovery = discovery;

    if (status === "approved" && slidesInvalid) return;

    const response = await fetch("/api/instagram/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: currentDiscovery.id,
        status,
        archiveCategory,
        carouselSlides: status === "approved" ? carouselSlides : null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data.error);
      return;
    }

    setLastReviewed({
      discovery: currentDiscovery,
      status,
    });

    setDiscovery(data.nextDiscovery);
    setSlidesInput("");

    setCounts((current) => ({
      ...current,
      pending: Math.max(current.pending - 1, 0),
      approved: status === "approved" ? current.approved + 1 : current.approved,
      rejected: status === "rejected" ? current.rejected + 1 : current.rejected,
    }));
  }

  async function undoLastReview() {
    if (!lastReviewed) return;

    const response = await fetch("/api/instagram/undo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: lastReviewed.discovery.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data.error);
      return;
    }

    setDiscovery(lastReviewed.discovery);
    setSlidesInput("");

    setCounts((current) => ({
      ...current,
      pending: current.pending + 1,
      approved:
        lastReviewed.status === "approved"
          ? Math.max(current.approved - 1, 0)
          : current.approved,
      rejected:
        lastReviewed.status === "rejected"
          ? Math.max(current.rejected - 1, 0)
          : current.rejected,
    }));

    setLastReviewed(null);
  }

  return (
    <section className={styles.reviewer}>
      <header className={styles.progress}>
        <p className={styles.progressRemaining}>
          {counts.pending} Instagram clips left to review
        </p>

        <p className={styles.progressStats}>
          {counts.approved} approved · {counts.rejected} rejected ·{" "}
          {counts.total} total
        </p>

        <p className={styles.progressFiltered}>
          {counts.autoRejected} filtered out automatically
        </p>

        <div className={styles.progressDetails}>
          <span>
            {reviewed} / {counts.total} reviewed
          </span>

          <span>{progress}%</span>
        </div>

        <progress
          className={styles.progressBar}
          value={reviewed}
          max={counts.total}
        />
      </header>
      {!discovery && (
        <div className={styles.emptyState}>No Instagram posts left to review.</div>
      )}
      {discovery && (
        <div className={styles.reviewLayout}>
          {/* Post */}
          <div className={styles.mediaColumn}>
            <div className={styles.embedWrapper}>
              {discovery.video_url ? (
                <SlideVideo key={discovery.id} discovery={discovery} />
              ) : (
                <iframe
                  key={discovery.id}
                  className={styles.embed}
                  src={`https://www.instagram.com/p/${discovery.platform_video_id}/embed/`}
                  title={discovery.title}
                  allowFullScreen
                />
              )}
            </div>
          </div>

          {/* Information */}
          <div className={styles.infoColumn}>
            <div className={styles.metadata}>
              <a
                className={styles.channel}
                href={`https://www.instagram.com/${discovery.channel_name}/`}
                target="_blank"
                rel="noreferrer"
              >
                @{discovery.channel_name}
              </a>

              <p className={styles.date}>
                {discovery.published_at
                  ? new Date(discovery.published_at).toLocaleDateString("en-GB")
                  : "No date"}
              </p>

              {isSlide && (
                <p className={styles.slideBadge}>
                  Slide {discovery.slide_number}
                  {discovery.carousel_video_slides?.length > 1 &&
                    ` · video ${discovery.carousel_video_slides.indexOf(discovery.slide_number) + 1} of ${discovery.carousel_video_slides.length} in this carousel`}
                </p>
              )}

              {discovery.description && (
                <p className={styles.caption}>{discovery.description}</p>
              )}

              <a
                className={styles.instagramLink}
                href={discovery.source_url}
                target="_blank"
                rel="noreferrer"
              >
                {isSlide ? `Open slide ${discovery.slide_number} on Instagram ↗` : "Open on Instagram ↗"}
              </a>
            </div>

            <div className={styles.actions}>
              {isCarousel && (
                <div className={styles.slidePicker}>
                  <label className={styles.slideLabel} htmlFor="carousel-slides">
                    Carousel slides to keep
                  </label>

                  <input
                    id="carousel-slides"
                    className={`${styles.slideInput} ${slidesInvalid ? styles.slideInputInvalid : ""}`}
                    value={slidesInput}
                    onChange={(event) => setSlidesInput(event.target.value)}
                    placeholder="e.g. 17, 19 or 17-19"
                    inputMode="numeric"
                  />

                  <p className={styles.slideHint}>
                    {slidesInvalid
                      ? "Use slide numbers separated by commas, or a range like 17-19."
                      : carouselSlides
                        ? `Keeping slide${carouselSlides.length > 1 ? "s" : ""} ${carouselSlides.join(", ")}.`
                        : "Blank keeps every video in the carousel."}{" "}
                    {discovery.carousel_video_slides.length > 0 &&
                      `Scraper saw videos at ${discovery.carousel_video_slides.join(", ")} (it can miss slides at the end).`}
                  </p>
                </div>
              )}

              <p className={styles.actionLabel}>Keep as</p>

              <div className={styles.categoryGrid}>
                {CATEGORIES.map((category) => (
                  <button
                    className={styles.categoryButton}
                    key={category}
                    onClick={() => review("approved", category)}
                    disabled={slidesInvalid}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <button
                className={styles.rejectButton}
                onClick={() => review("rejected")}
              >
                Reject
              </button>

              <button
                className={styles.undoButton}
                onClick={undoLastReview}
                disabled={!lastReviewed}
              >
                Undo
              </button>

              <div className={styles.details}>
                <p className={styles.detail}>
                  <span>Suggested type</span>
                  {discovery.suggested_content_type ?? "—"}
                </p>

                <p className={styles.detail}>
                  <span>Discovery score</span>
                  {discovery.discovery_score}
                </p>

                {discovery.score_reasons?.length > 0 && (
                  <p className={`${styles.detail} ${styles.detailWide}`}>
                    <span>Why this score</span>
                    {discovery.score_reasons.join(" · ")}
                  </p>
                )}

                <p className={styles.detail}>
                  <span>Audio</span>
                  {describeAudio(discovery)}
                </p>

                <p className={styles.detail}>
                  <span>Found via</span>
                  {discovery.search_query ?? "—"}
                </p>

                {discovery.video_duration_seconds != null && (
                  <p className={styles.detail}>
                    <span>Length</span>
                    {Math.round(discovery.video_duration_seconds)}s
                  </p>
                )}

                <p className={styles.detail}>
                  <span>Plays</span>
                  {formatNumber(discovery.play_count)}
                </p>

                <p className={styles.detail}>
                  <span>Likes</span>
                  {formatNumber(discovery.likes_count)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
