"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

export default function ThreadPage() {
  const { thread_id } = useParams();

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const ACCENT_COLOR = "#C89632"; // Your provided warm golden color (RGB 200, 150, 50)

  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState(null);
  const [venue, setVenue] = useState(null);
  const [userCache, setUserCache] = useState({});
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  function getToken() {
    const token = localStorage.getItem("access_token");
    if (!token) throw new Error("Login required.");
    return token;
  }

  async function fetchUser(userId) {
    if (userCache[userId]) return userCache[userId];

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return null;

      const data = await res.json();

      setUserCache((prev) => ({
        ...prev,
        [userId]: data,
      }));

      return data;
    } catch {
      return null;
    }
  }

  async function loadMe() {
    const token = getToken();
    const res = await fetch(`${API_BASE}/auth/me`, {
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

    const data = await res.json();
    setMessages(data);

    // preload users
    data.forEach((m) => {
      fetchUser(m.sender_user_id);
    });
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
    Promise.all([loadMe(), loadMessages(), loadVenue()]).catch((e) =>
      setError(e.message)
    );
  }, [thread_id]);

  useEffect(() => {
    let timer = null;
    try {
      getToken();
      timer = setInterval(() => {
        loadMessages().catch(() => {});
      }, 5000);
    } catch {}

    return () => {
      if (timer) clearInterval(timer);
    };
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
    <main
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "#f8f9fa",
        minHeight: "100vh",
        padding: "20px 0",
      }}
    >
      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          background: "white",
          borderRadius: 16,
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "white",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <a
            href="/threads"
            style={{
              textDecoration: "none",
              color: "#333",
              fontSize: 18,
              fontWeight: 500,
            }}
          >
            ←
          </a>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 18, color: "#111" }}>Conversation</div>
            {venue && (
              <div style={{ fontSize: 14, color: "#666" }}>
                <a
                  href={`/venues/${venue.id}`}
                  style={{ color: ACCENT_COLOR, textDecoration: "none" }}
                >
                  {venue.title}
                </a>
              </div>
            )}
          </div>

          {/* My avatar in header (nice professional touch) */}
          {me && (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              {me.avatar_url ? (
                <img
                  src={`${API_BASE}${me.avatar_url}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  alt="You"
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: ACCENT_COLOR,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {(me.name || me.email || "?")[0]?.toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MESSAGES AREA */}
        <div
          style={{
            height: "calc(100vh - 220px)",
            minHeight: 400,
            overflowY: "auto",
            padding: "24px",
            background: "#f8f9fa",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {error && (
            <div
              style={{
                color: "crimson",
                padding: 12,
                background: "#ffebee",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {messages === null ? (
            <div style={{ textAlign: "center", padding: 60, color: "#666" }}>Loading messages...</div>
          ) : messages.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 80,
                color: "#888",
                fontSize: 15,
              }}
            >
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((m) => {
              const isMine = me && m.sender_user_id === me.id;
              const sender = userCache[m.sender_user_id];
              const avatarUrl = isMine ? me?.avatar_url : sender?.avatar_url;

              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: isMine ? "flex-end" : "flex-start",
                    gap: 12,
                  }}
                >
                  {!isMine && <Avatar sender={sender} avatarUrl={avatarUrl} apiBase={API_BASE} />}

                  <div style={{ maxWidth: "68%" }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 4,
                        color: "#555",
                        paddingLeft: isMine ? 0 : 4,
                        textAlign: isMine ? "right" : "left",
                      }}
                    >
                      {isMine ? "You" : sender?.name || sender?.email || "User"}
                    </div>

                    <div
                      style={{
                        padding: "13px 18px",
                        borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        background: isMine ? ACCENT_COLOR : "#ffffff",
                        color: isMine ? "white" : "#222",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                        border: isMine ? "none" : "1px solid #eee",
                        lineHeight: 1.5,
                        fontSize: "15.5px",
                      }}
                    >
                      {m.body}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: "#999",
                        marginTop: 5,
                        textAlign: isMine ? "right" : "left",
                        paddingRight: isMine ? 6 : 0,
                      }}
                    >
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  {isMine && <Avatar sender={me} avatarUrl={avatarUrl} apiBase={API_BASE} />}
                </div>
              );
            })
          )}
        </div>

        {/* INPUT AREA */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #eee",
            background: "white",
            position: "sticky",
            bottom: 0,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message..."
              rows={1}
              style={{
                flex: 1,
                padding: "14px 18px",
                borderRadius: 20,
                border: "1px solid #ddd",
                resize: "none",
                fontSize: 16,
                minHeight: 52,
                outline: "none",
                fontFamily: "inherit",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />

            <button
              onClick={sendMessage}
              disabled={busy || !body.trim()}
              style={{
                padding: "14px 28px",
                borderRadius: 20,
                background: body.trim() ? ACCENT_COLOR : "#e5e5e5",
                color: "white",
                border: "none",
                fontWeight: 600,
                cursor: body.trim() ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                minWidth: 70,
              }}
            >
              {busy ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Avatar({ sender, avatarUrl, apiBase }) {
  return (
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: "50%",
        background: "#f0f0f0",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        border: "2px solid white",
      }}
    >
      {avatarUrl ? (
        <img
          src={`${apiBase}${avatarUrl}`}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          alt="avatar"
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 17,
            fontWeight: 600,
            color: "#555",
            background: "#e8e8e8",
          }}
        >
          {(sender?.email || "?")[0]?.toUpperCase()}
        </div>
      )}
    </div>
  );
}