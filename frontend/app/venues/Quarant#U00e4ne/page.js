"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function VenuesPage() {
  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [venues, setVenues] = useState([]);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    city: "",
    capacity: 50,
    payout_net_per_night: 10000, // cents
  });

  async function loadVenues() {
    setError("");
    const res = await fetch(`${API_BASE}/venues`);
    if (!res.ok) throw new Error(await res.text());
    setVenues(await res.json());
  }

  async function createVenue(e) {
    e.preventDefault();
    setError("");

    // Your app stores the JWT under access_token
    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("Login required to create venues (host).");
      return;
    }

    const res = await fetch(`${API_BASE}/venues`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });

    if (!res.ok) throw new Error(await res.text());

    setForm({
      title: "",
      description: "",
      city: "",
      capacity: 50,
      payout_net_per_night: 10000,
    });

    await loadVenues();
  }

  useEffect(() => {
    loadVenues().catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Venues</h1>

      {error ? (
        <div style={{ marginBottom: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      ) : null}

      <h2>Create venue (host)</h2>

      <form onSubmit={createVenue} style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        {/* NEW: required by backend */}
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <input
          placeholder="City"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />

        <input
          type="number"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
        />

        <input
          type="number"
          value={form.payout_net_per_night}
          onChange={(e) =>
            setForm({ ...form, payout_net_per_night: Number(e.target.value) })
          }
        />

        <button type="submit">Create</button>
      </form>

      <h2>Available venues</h2>

      <ul>
        {venues.map((v) => (
          <li key={v.id} style={{ marginBottom: 10 }}>
            <b>{v.title}</b> — {v.city} — cap {v.capacity} — net €{" "}
            {typeof v.payout_net_per_night === "number"
              ? (v.payout_net_per_night / 100).toFixed(2)
              : "0.00"}
            <br />
            <Link href={`/venues/${v.id}`}>View & book</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}