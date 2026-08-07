"use client";

import { useState } from "react";
import styles from "./DiscoveryReviewer.module.css";

const CATEGORIES = [
  "Interview",
  "Professional Live",
  "Fan Live",
  "Backstage / Tour",
  "Studio / Acoustic",
  "Official / Promo",
  "Other",
];

export default function DiscoveryReviewer({ initialDiscovery, initialCounts }) {
  const [discovery, setDiscovery] = useState(initialDiscovery);

  const [counts, setCounts] = useState(initialCounts);

  const reviewed = counts.approved + counts.rejected;

  const progress =
    counts.total > 0 ? Math.round((reviewed / counts.total) * 100) : 0;

  async function review(status, archiveCategory = null) {
    const response = await fetch("/api/discoveries/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: discovery.id,
        status,
        archiveCategory,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data.error);
      return;
    }

    setDiscovery(data.nextDiscovery);

    setCounts((current) => ({
      ...current,
      pending: Math.max(current.pending - 1, 0),
      approved: status === "approved" ? current.approved + 1 : current.approved,
      rejected: status === "rejected" ? current.rejected + 1 : current.rejected,
    }));
  }

  return (
    <section className={styles.reviewer}>
      <header className={styles.progress}>
        <h1 className={styles.progressTitle}>Content Review</h1>

        <p className={styles.progressRemaining}>
          {counts.pending} videos left to review
        </p>

        <p className={styles.progressStats}>
          {counts.approved} approved · {counts.rejected} rejected ·{" "}
          {counts.total} total
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
        <div className={styles.emptyState}>No discoveries left to review.</div>
      )}
      {discovery && (
        <div className={styles.reviewLayout}>
          {/* Video */}
          <div className={styles.mediaColumn}>
            {discovery.platform === "youtube" ? (
              <div className={styles.videoWrapper}>
                <iframe
                  className={styles.video}
                  src={`https://www.youtube.com/embed/${discovery.platform_video_id}`}
                  title={discovery.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              discovery.thumbnail_url && (
                <img
                  className={styles.thumbnail}
                  src={discovery.thumbnail_url}
                  alt=""
                />
              )
            )}
            <div className={styles.metadata}>
              <h2 className={styles.title}>{discovery.title}</h2>

              <p className={styles.channel}>{discovery.channel_name}</p>

              <p className={styles.date}>
                {new Date(discovery.published_at).toLocaleDateString()}
              </p>

              <a
                className={styles.youtubeLink}
                href={discovery.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Open on YouTube ↗
              </a>
            </div>
          </div>

          {/* Information */}
          <div className={styles.infoColumn}>
            <div className={styles.actions}>
              <p className={styles.actionLabel}>Keep as</p>

              <div className={styles.categoryGrid}>
                {CATEGORIES.map((category) => (
                  <button
                    className={styles.categoryButton}
                    key={category}
                    onClick={() => review("approved", category)}
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
              <div className={styles.details}>
                <p className={styles.detail}>
                  <span>Suggested type</span>
                  {discovery.suggested_content_type}
                </p>

                <p className={styles.detail}>
                  <span>Discovery score</span>
                  {discovery.discovery_score}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
