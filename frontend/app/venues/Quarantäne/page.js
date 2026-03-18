"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const CATEGORIES = [
  "Art & Culture",
  "Creative Production",
  "Events & Social",
  "Workshops & Education",
  "Professional / Business",
  "Community Spaces",
  "Unique Spaces",
];

export default function VenuesPage() {
  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [venues, setVenues] = useState([]);
  const [filteredVenues, setFilteredVenues] = useState([]);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);

  async function loadVenues() {
    setError("");

    const res = await fetch(`${API_BASE}/venues/search`);
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    setVenues(data);
    setFilteredVenues(data);
  }

  useEffect(() => {
    loadVenues().catch((e) => setError(String(e)));
  }, []);

  function selectCategory(categoryLabel) {
    if (categoryLabel === selectedCategory) {
      setSelectedCategory(null);
      setFilteredVenues(venues);
      return;
    }

    setSelectedCategory(categoryLabel);

    const filtered = venues.filter(
      (v) => (v.venue_category || "") === categoryLabel
    );
    setFilteredVenues(filtered);
  }

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: "0 24px",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, marginBottom: 10 }}>Discover venues</h1>
        <div style={{ fontSize: 15, opacity: 0.75 }}>
          Browse by category or explore all available venues.
        </div>
      </div>

      {error ? (
        <div style={{ color: "crimson", marginBottom: 16 }}>{error}</div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 28,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => {
            setSelectedCategory(null);
            setFilteredVenues(venues);
          }}
          style={{
            padding: "10px 16px",
            borderRadius: 999,
            border: selectedCategory === null ? "2px solid black" : "1px solid #ccc",
            background: "white",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          All
        </button>

        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => selectCategory(category)}
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border:
                selectedCategory === category
                  ? "2px solid black"
                  : "1px solid #ccc",
              background: "white",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {category}
          </button>
        ))}
      </div>

      {filteredVenues.length === 0 ? (
        <div style={{ fontSize: 16, opacity: 0.8 }}>No venues found.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {filteredVenues.map((v) => (
            <div
              key={v.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 14,
                padding: 16,
                background: "white",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                {v.title}
              </div>

              <div style={{ marginBottom: 8 }}>
                {v.city} — cap {v.capacity}
              </div>

              <div style={{ marginBottom: 8 }}>
                €{(v.payout_net_per_night / 100).toFixed(2)} / night
              </div>

              <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 12 }}>
                {v.venue_category || "Uncategorized"}
                {v.venue_type ? ` · ${v.venue_type}` : ""}
              </div>

              <Link href={`/venues/${v.id}`}>View venue</Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}