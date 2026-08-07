"use client";

import { useState } from "react";

const CATEGORIES = [
  "Interview",
  "Professional Live",
  "Fan Live",
  "Backstage / Tour",
  "Studio / Acoustic",
  "Official / Promo",
  "Other",
];

export default function DiscoveryReviewer({ initialDiscovery }) {
  const [discovery, setDiscovery] = useState(initialDiscovery);

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
  }

  if (!discovery) {
    return <p>No discoveries left to review.</p>;
  }

  return (
    <section>
      {discovery.thumbnail_url && <img src={discovery.thumbnail_url} alt="" />}

      <h1>{discovery.title}</h1>

      <p>{discovery.channel_name}</p>

      <p>{new Date(discovery.published_at).toLocaleDateString()}</p>

      <p>Suggested type: {discovery.suggested_content_type}</p>

      <p>Discovery score: {discovery.discovery_score}</p>

      <a href={discovery.source_url} target="_blank" rel="noreferrer">
        Open on YouTube
      </a>

      <div>
        {CATEGORIES.map((category) => (
          <button key={category} onClick={() => review("approved", category)}>
            {category}
          </button>
        ))}
      </div>

      <button onClick={() => review("rejected")}>Reject</button>
    </section>
  );
}
