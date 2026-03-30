"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import BookingCard from "../../components/BookingCard";
import VenueGallery from "../../components/VenueGallery";

export default function VenuePage() {
  const params = useParams();
  const venueId = params?.venue_id;

  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [venue, setVenue] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // --- DATA FETCHING ---
  
  async function loadMeIfLoggedIn() {
    const token = localStorage.getItem("access_token");
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function loadVenue(meData) {
    try {
      const res = await fetch(`${API_BASE}/venues/${venueId}`, {
        cache: "no-store",
      });

      if (res.ok) {
        return await res.json();
      }

      const token = localStorage.getItem("access_token");
      if (token && meData) {
        const mineRes = await fetch(`${API_BASE}/venues/mine`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (mineRes.ok) {
          const mineList = await mineRes.json();
          const mineFound = Array.isArray(mineList)
            ? mineList.find((x) => String(x.id) === String(venueId))
            : null;
          if (mineFound) return mineFound;
        }
      }

      const text = await res.text();
      throw new Error(text || "Venue not found.");
    } catch (e) {
      throw e;
    }
  }

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError("");
      try {
        const meData = await loadMeIfLoggedIn();
        setMe(meData);
        const venueData = await loadVenue(meData);
        setVenue(venueData);
      } catch (e) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    if (venueId) run();
  }, [venueId, API_BASE]);

  // --- RENDER STATES ---

  if (loading) {
    return (
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui" }}>
        <div>Loading venue...</div>
      </main>
    );
  }

  if (error || !venue) {
    return (
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui" }}>
        <h1 style={{ marginBottom: 12 }}>Venue</h1>
        <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>
          {error || "Venue not found."}
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/venues">← Back to venues</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui" }}>
      <style>{`
        .rdp-day_selected:not(.rdp-day_outside) { 
          background-color: blue !important; 
          color: white !important; 
          opacity: 1 !important;
        }
        .rdp-day_range_start { border-radius: 50% 0 0 50% !important; }
        .rdp-day_range_end { border-radius: 0 50% 50% 0 !important; }
        .rdp-day_range_start.rdp-day_range_end { border-radius: 50% !important; }
      `}</style>

      <div style={{ marginBottom: 20 }}>
        <Link href="/venues">← Back to venues</Link>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 16,
          overflow: "visible",
          background: "white",
          marginBottom: 24,
        }}
      >
        <VenueGallery
          title={venue.title}
          apiBase={API_BASE}
          coverImageUrl={venue.cover_image_url}
          legacyImageUrl={venue.image_url}
          images={venue.images || []}
        />

        <div style={{ padding: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 0.95fr)",
              gap: 24,
            }}
          >
            {/* LEFT COLUMN */}
            <div>
              <h1 style={{ marginTop: 0, marginBottom: 10 }}>{venue.title}</h1>
              <div style={{ marginBottom: 8 }}>
                {venue.city} — cap {venue.capacity}
              </div>
              
              {(venue.venue_category || venue.venue_type) && (
                <div style={{ marginBottom: 16, fontSize: 14, opacity: 0.85 }}>
                  {venue.venue_category && <div>Category: <b>{venue.venue_category}</b></div>}
                  {venue.venue_type && <div>Type: <b>{venue.venue_type}</b></div>}
                </div>
              )}

              <div style={{ marginBottom: 20, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {venue.description || "No description yet."}
              </div>

              {venue.rules_and_restrictions && (
                <div style={{ marginTop: 20, padding: 16, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
                  <h3 style={{ marginTop: 0 }}>Rules & restrictions</h3>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {venue.rules_and_restrictions}
                  </div>
                </div>
              )}
              
              <div style={{ marginTop: 14, fontSize: 13, color: "#670" }}>
                Status: <b>{venue.status || "—"}</b>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <BookingCard
              venue={venue}
              me={me}
              API_BASE={API_BASE}
              initialFrom={from}
              initialTo={to}
            />
          </div>
        </div>
      </div>
    </main>
  );
}