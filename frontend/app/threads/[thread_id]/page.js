"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

export default function ThreadPage() {
  const { thread_id } = useParams();

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000",
    []
  );

  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState(null);
  const [venue, setVenue] = useState(null);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  function getToken() {
    const token = localStorage.getItem("access_token");
    if (!token) throw new Error("Login required.");
    return token;
  }

  async function loadMe() {
    const token = getToken();
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    setMe(await res.json());
  }

  async function loadMessages() {
    const token = getToken();
    const res = await fetch(`${API_BASE}/threads/${thread_id}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    setMessages(await res.json());
  }

  async function loadVenue() {
    const token = getToken();

    const res = await fetch(`${API_BASE}/threads`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(await res.text());

    const threads = await res.json();
    const thread = threads.find((t) => String(t.id) === String(thread_id));

    if (!thread || !thread.venue_id) return;

    const vres = await fetch(`${API_BASE}/venues/${thread.venue_id}`);
    if (!vres.ok) throw new Error(await vres.text());

    setVenue(await vres.json());
  }

  useEffect(() => {
    setError("");
    Promise.all([loadMe(), loadMessages(), loadVenue()])
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread_id]);

  // light polling (safe, no websockets)
  useEffect(() => {
    let timer = null;
    try {
      getToken();
      timer = setInterval(() => {
        loadMessages().catch(() => {});
      }, 5000);
    } catch {
      // not logged in
    }
    return () => {
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread_id]);

  async function sendMessage() {
    setError("");
    const trimmed = body.trim();
    if (!trimmed) return;

    setBusy(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/threads/${thread_id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ body: trimmed }),
      });

      if (!res.ok) throw new Error(await res.text());

      setBody("");
      await loadMessages();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <a href="/threads">← Inbox</a>{" "}
        <span style={{ margin: "0 10px" }}>|</span>
        <a href="/venues">Venues</a>
      </div>

      <h1>Conversation</h1>

      {venue && (
        <div style={{ marginBottom: 14 }}>
          <b>Venue:</b>{" "}
          <a href={`/venues/${venue.id}`}>
            {venue.title}
          </a>

          <span style={{ margin: "0 10px" }}>|</span>

          <a href={`/my-venues/${venue.id}`}>
            Manage venue
          </a>
        </div>
      )}

      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
        Thread ID:{" "}
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
          {thread_id}
        </span>
      </div>

      {error && (
        <div style={{ color: "crimson", marginBottom: 12, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}

      {messages === null ? (
        <div>Loading messages...</div>
      ) : messages.length === 0 ? (
        <div style={{ opacity: 0.8, marginBottom: 12 }}>No messages yet. Say hello 👋</div>
      ) : (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            background: "white",
          }}
        >
          {messages.map((m) => {
            const isMine = me && m.sender_user_id === me.id;
            return (
              <div key={m.id} style={{ marginBottom: 10, textAlign: isMine ? "right" : "left" }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    maxWidth: "80%",
                    whiteSpace: "pre-wrap",
                    background: "white",
                  }}
                >
                  {m.body}
                </div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                  {String(m.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          rows={4}
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={sendMessage} disabled={busy} style={{ padding: 10 }}>
            {busy ? "Sending..." : "Send"}
          </button>
          <button onClick={() => loadMessages().catch(() => {})} style={{ padding: 10 }}>
            Refresh
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Messages auto-refresh every 5 seconds.
        </div>
      </div>
    </main>
  );
}