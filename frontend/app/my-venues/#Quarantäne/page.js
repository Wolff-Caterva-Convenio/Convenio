"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function MyVenuesPage() {
  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [me, setMe] = useState(null);
  const [venues, setVenues] = useState(null);
  const [error, setError] = useState("");

  function getToken() {
    const token = localStorage.getItem("access_token");
    if (!token) throw new Error("Login required.");
    return token;
  }

  async function load() {
    setError("");

    const token = getToken();

    const meRes = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!meRes.ok) throw new Error(await meRes.text());
    setMe(await meRes.json());

    const venuesRes = await fetch(`${API_BASE}/venues/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!venuesRes.ok) throw new Error(await venuesRes.text());
    setVenues(await venuesRes.json());
  }

  useEffect(() => {
    load().catch((e) => {
      setError(e.message || String(e));
      setVenues([]);
    });
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>My venues</h1>

      {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}

      {me && (
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>
          Logged in as <b>{me.email}</b>
        </div>
      )}

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

        {venues === null ? (
          <div>Loading...</div>
        ) : venues.length === 0 ? (
          <div>You don’t own any venues yet.</div>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {venues.map((v) => (
              <li key={v.id} style={{ marginBottom: 12 }}>
                <div>
                  <b>{v.title}</b> — {v.city} — cap {v.capacity} — net €
                  {(v.payout_net_per_night / 100).toFixed(2)}
                </div>

                <div style={{ marginTop: 4 }}>
                  Status: <b>{v.status || "draft"}</b>
                </div>

                <div style={{ marginTop: 6 }}>
                  <a href={`/my-venues/${v.id}`} style={{ marginRight: 12 }}>
                    Manage venue
                  </a>

                  <a href={`/venues/${v.id}/availability`} style={{ marginRight: 12 }}>
                    Manage availability
                  </a>

                  <a href={`/venues/${v.id}`} style={{ marginRight: 12 }}>
                    View listing
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}