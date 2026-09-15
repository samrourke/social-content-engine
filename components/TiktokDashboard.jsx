"use client";

import { useMemo, useState } from "react";
import styles from "./TiktokDashboard.module.css";

const SORT_OPTIONS = [
  { key: "views", label: "Views" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "engagementRate", label: "Engagement" },
  { key: "post_date", label: "Newest" },
];

function engagementRate(video) {
  if (!video.views) return 0;
  return ((video.likes ?? 0) + (video.comments ?? 0) + (video.shares ?? 0)) / video.views;
}

function formatNumber(value) {
  if (value === null || value === undefined) return "—";

  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }

  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }

  return String(value);
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TiktokDashboard({
  latestSnapshot,
  firstSnapshot,
  videos,
  pillars,
}) {
  const [sortKey, setSortKey] = useState("views");
  const [pillar, setPillar] = useState("all");

  const enrichedVideos = useMemo(
    () => videos.map((video) => ({ ...video, engagementRate: engagementRate(video) })),
    [videos],
  );

  const filteredVideos = useMemo(() => {
    const list =
      pillar === "all"
        ? enrichedVideos
        : enrichedVideos.filter((video) => video.content_pillar === pillar);

    return [...list].sort((a, b) => {
      if (sortKey === "post_date") {
        return new Date(b.post_date ?? 0) - new Date(a.post_date ?? 0);
      }
      return (b[sortKey] ?? 0) - (a[sortKey] ?? 0);
    });
  }, [enrichedVideos, pillar, sortKey]);

  const totalViews = enrichedVideos.reduce((sum, video) => sum + (video.views ?? 0), 0);
  const avgViews = enrichedVideos.length ? Math.round(totalViews / enrichedVideos.length) : 0;
  const avgEngagement = enrichedVideos.length
    ? enrichedVideos.reduce((sum, video) => sum + video.engagementRate, 0) / enrichedVideos.length
    : 0;

  const followerDelta =
    latestSnapshot && firstSnapshot && latestSnapshot.id !== firstSnapshot.id
      ? latestSnapshot.follower_count - firstSnapshot.follower_count
      : null;

  return (
    <section className={styles.dashboard}>
      <header className={styles.progress}>
        <h1 className={styles.progressTitle}>TikTok Performance</h1>

        <p className={styles.progressRemaining}>
          {latestSnapshot ? formatNumber(latestSnapshot.follower_count) : "—"}{" "}
          followers
        </p>

        <p className={styles.progressStats}>
          {enrichedVideos.length} videos tracked ·{" "}
          {latestSnapshot ? formatNumber(latestSnapshot.likes_total) : "—"} total
          likes
          {latestSnapshot && (
            <> · updated {formatDate(latestSnapshot.scraped_at)}</>
          )}
        </p>
      </header>

      <div className={styles.details}>
        <div className={styles.detail}>
          <span>Followers</span>
          {latestSnapshot ? formatNumber(latestSnapshot.follower_count) : "—"}
          {followerDelta !== null && (
            <em className={followerDelta >= 0 ? styles.up : styles.down}>
              {followerDelta >= 0 ? "+" : ""}
              {formatNumber(followerDelta)} since {formatDate(firstSnapshot.scraped_at)}
            </em>
          )}
        </div>

        <div className={styles.detail}>
          <span>Videos tracked</span>
          {enrichedVideos.length}
        </div>

        <div className={styles.detail}>
          <span>Avg views / video</span>
          {formatNumber(avgViews)}
        </div>

        <div className={styles.detail}>
          <span>Avg engagement rate</span>
          {(avgEngagement * 100).toFixed(1)}%
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.sortGroup}>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              className={`${styles.sortButton} ${
                sortKey === option.key ? styles.sortButtonActive : ""
              }`}
              onClick={() => setSortKey(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {pillars.length > 0 && (
          <select value={pillar} onChange={(event) => setPillar(event.target.value)}>
            <option value="all">All content pillars</option>
            {pillars.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        )}
      </div>

      {filteredVideos.length === 0 && (
        <div className={styles.emptyState}>No videos match this filter.</div>
      )}

      <div className={styles.videoList}>
        {filteredVideos.map((video) => (
          <div className={styles.videoRow} key={video.platform_video_id}>
            <div className={styles.videoCaption}>
              <p className={styles.caption}>{video.caption || "(no caption)"}</p>
              <p className={styles.date}>{formatDate(video.post_date)}</p>

              {video.content_pillar && (
                <span className={styles.pillarTag}>{video.content_pillar}</span>
              )}
            </div>

            <div className={styles.videoStats}>
              <div className={styles.stat}>
                <span>Views</span>
                {formatNumber(video.views)}
              </div>
              <div className={styles.stat}>
                <span>Likes</span>
                {formatNumber(video.likes)}
              </div>
              <div className={styles.stat}>
                <span>Comments</span>
                {formatNumber(video.comments)}
              </div>
              <div className={styles.stat}>
                <span>Shares</span>
                {formatNumber(video.shares)}
              </div>
              <div className={styles.stat}>
                <span>Engagement</span>
                {(video.engagementRate * 100).toFixed(1)}%
              </div>
            </div>

            <a
              className={styles.tiktokLink}
              href={video.video_url}
              target="_blank"
              rel="noreferrer"
            >
              Open on TikTok ↗
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
