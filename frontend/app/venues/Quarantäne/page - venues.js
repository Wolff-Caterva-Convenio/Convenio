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
  const [search, setSearch] = useState("");

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

  function applyFilters(category, searchText) {
    let result = [...venues];

    if (category) {
      result = result.filter((v) => (v.venue_category || "") === category);
    }

    if (searchText) {
      const q = searchText.toLowerCase();

      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.city.toLowerCase().includes(q) ||
          (v.venue_type || "").toLowerCase().includes(q)
      );
    }

    setFilteredVenues(result);
  }

  function selectCategory(categoryLabel) {
    const newCategory =
      categoryLabel === selectedCategory ? null : categoryLabel;

    setSelectedCategory(newCategory);
    applyFilters(newCategory, search);
  }

  function updateSearch(value) {
    setSearch(value);
    applyFilters(selectedCategory, value);
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: "0 20px",
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

      <div style={{ marginBottom: 24 }}>
        <input
          placeholder="Search venues, cities, or ideas..."
          value={search}
          onChange={(e) => updateSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 500,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            fontSize: 15,
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 28,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => {
            setSelectedCategory(null);
            applyFilters(null, search);
          }}
          style={{
            padding: "10px 16px",
            borderRadius: 999,
            border:
              selectedCategory === null
                ? "2px solid black"
                : "1px solid #ccc",
            background: "white",
            cursor: "pointer",
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
            gap: 20,
          }}
        >
          {filteredVenues.map((v) => {
            const imagePath = v.cover_image_url || v.image_url || null;
            const imageUrl = imagePath ? `${API_BASE}${imagePath}` : null;

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
                    alt={v.title}
                    style={{
                      height: 160,
                      width: "100%",
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

                  <div style={{ fontSize: 14, marginBottom: 10 }}>
                    €{(v.payout_net_per_night / 100).toFixed(2)} / night
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.7,
                      marginBottom: 12,
                    }}
                  >
                    {v.venue_category || "Uncategorized"}
                    {v.venue_type ? ` · ${v.venue_type}` : ""}
                  </div>

                  <Link href={`/venues/${v.id}`}>View venue</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}