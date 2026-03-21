"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function getVenueCardImagePath(v) {
  const images = Array.isArray(v?.images) ? v.images : [];

  const explicitCover = images.find((img) => img?.is_cover && img?.image_url);
  if (explicitCover?.image_url) return explicitCover.image_url;

  const firstGalleryImage = images.find((img) => img?.image_url);
  if (firstGalleryImage?.image_url) return firstGalleryImage.image_url;

  return v?.image_url || null;
}

export default function MyVenuesPage() {
  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [me, setMe] = useState(null);
  const [venues, setVenues] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function getToken() {
    const token = localStorage.getItem("access_token");
    if (!token) throw new Error("Login required.");
    return token;
  }

  async function load() {
    setError("");
    setLoading(true);

    try {
      const token = getToken();

      const meRes = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!meRes.ok) throw new Error(await meRes.text());
      const meData = await meRes.json();
      setMe(meData);

      const venuesRes = await fetch(`${API_BASE}/venues/mine`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!venuesRes.ok) throw new Error(await venuesRes.text());

      const venuesData = await venuesRes.json();
      setVenues(Array.isArray(venuesData) ? venuesData : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((e) => {
      setError(e?.message || String(e));
      setVenues([]);
    });
  }, [API_BASE]);

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ marginTop: 0, marginBottom: 24 }}>My venues</h1>

      {error ? (
        <div style={{ color: "crimson", marginBottom: 12, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      ) : null}

      {me ? (
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>
          Logged in as <b>{me.email}</b>
        </div>
      ) : null}

      <div style={{ marginBottom: 20 }}>
        <Link
          href="/my-venues/new"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #222",
            textDecoration: "none",
            background: "white",
            marginRight: 10,
          }}
        >
          Create new venue
        </Link>

        <Link
          href="/my-venues/bookings"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ddd",
            textDecoration: "none",
            background: "white",
          }}
        >
          View all bookings
        </Link>
      </div>

      <section>
        <h2>My venues</h2>

        {loading ? (
          <div>Loading...</div>
        ) : venues === null || venues.length === 0 ? (
          <div>You don’t own any venues yet.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {venues.map((v) => {
              const imagePath = getVenueCardImagePath(v);
              const imageUrl = imagePath ? `${API_BASE}${imagePath}` : null;
              const priceCents = Number(v?.payout_net_per_night ?? 0);

              return (
                <div
                  key={v.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "white",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={v.title || "Venue image"}
                      style={{
                        width: "100%",
                        height: 160,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 160,
                        background:
                          "linear-gradient(135deg, #e5e5e5 0%, #f5f5f5 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        color: "#777",
                      }}
                    >
                      Image coming soon
                    </div>
                  )}

                  <div style={{ padding: 16 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      {v.title}
                    </div>

                    <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>
                      {v.city} · cap {v.capacity}
                    </div>

                    <div style={{ fontSize: 14, marginBottom: 8 }}>
                      Net €{(priceCents / 100).toFixed(2)}
                    </div>

                    <div style={{ fontSize: 14, marginBottom: 8 }}>
                      Status: <b>{v.status || "draft"}</b>
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        marginBottom: 14,
                      }}
                    >
                      {v.venue_category || "Uncategorized"}
                      {v.venue_type ? ` · ${v.venue_type}` : ""}
                    </div>

                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <Link href={`/my-venues/${v.id}`}>Manage venue</Link>
                      <Link href={`/venues/${v.id}/availability`}>
                        Manage availability
                      </Link>
                      <Link href={`/venues/${v.id}`}>View listing</Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}