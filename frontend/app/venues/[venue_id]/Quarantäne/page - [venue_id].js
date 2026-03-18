"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function VenuePage() {
  const params = useParams();
  const venueId = params.venue_id;

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

  const [venue, setVenue] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadVenue() {
      try {
        const res = await fetch(`${API_BASE}/venues/${venueId}`);

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data = await res.json();
        setVenue(data);
      } catch (e) {
        setError(String(e));
      }
    }

    if (venueId) {
      loadVenue();
    }
  }, [venueId]);

  if (error) {
    return (
      <main style={{ padding: 40 }}>
        <div style={{ color: "crimson" }}>{error}</div>
      </main>
    );
  }

  if (!venue) {
    return (
      <main style={{ padding: 40 }}>
        <div>Loading venue...</div>
      </main>
    );
  }

  const imagePath = venue?.cover_image_url || venue?.image_url || null;
  const imageUrl = imagePath ? `${API_BASE}${imagePath}` : null;

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "system-ui",
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={venue.title}
          style={{
            width: "100%",
            height: 320,
            objectFit: "cover",
            borderRadius: 14,
            marginBottom: 24,
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: 320,
            background: "#eee",
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            color: "#777",
          }}
        >
          Image coming soon
        </div>
      )}

      <h1 style={{ marginBottom: 8 }}>{venue.title}</h1>

      <div style={{ marginBottom: 12, opacity: 0.8 }}>
        {venue.city} · capacity {venue.capacity}
      </div>

      <div style={{ marginBottom: 16 }}>
        €{(venue.payout_net_per_night / 100).toFixed(2)} per night
      </div>

      {venue.venue_category && (
        <div style={{ marginBottom: 6 }}>
          <strong>Category:</strong> {venue.venue_category}
        </div>
      )}

      {venue.venue_type && (
        <div style={{ marginBottom: 20 }}>
          <strong>Type:</strong> {venue.venue_type}
        </div>
      )}

      {venue.description && (
        <div style={{ marginTop: 20 }}>
          <h3>Description</h3>
          <p style={{ lineHeight: 1.6 }}>{venue.description}</p>
        </div>
      )}
    </main>
  );
}