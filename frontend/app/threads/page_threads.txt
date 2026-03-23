"use client";

import { useEffect, useMemo, useState } from "react";

export default function ThreadsPage() {
  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000",
    []
  );

  const [threads, setThreads] = useState(null);
  const [error, setError] = useState("");

  async function loadThreads() {
    setError("");
    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("Login required.");
      return;
    }

    const res = await fetch(`${API_BASE}/threads`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(await res.text());
    setThreads(await res.json());
  }

  useEffect(() => {
    loadThreads().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 900, margin: "0 auto" }}>

      <h1>Inbox</h1>

      {error && (
        <div style={{ color: "crimson", marginBottom: 12, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}

      {threads === null ? (
        <div>Loading threads...</div>
      ) : threads.length === 0 ? (
        <div>No conversations yet.</div>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {threads.map((t) => (
            <li key={t.id} style={{ marginBottom: 12 }}>
              <div>
                <b>{t.booking_id ? "Booking chat" : "Venue inquiry"}</b>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Thread: {t.id}
                <br />
                Venue: {t.venue_id}
                {t.booking_id ? (
                  <>
                    <br />
                    Booking: {t.booking_id}
                  </>
                ) : null}
                <br />
                Created: {String(t.created_at)}
              </div>
              <div style={{ marginTop: 6 }}>
                <a href={`/threads/${t.id}`}>Open conversation</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}