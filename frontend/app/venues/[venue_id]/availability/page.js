"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const MIN_DATE = "1900-01-01";
const MAX_DATE = "2100-01-01";

export default function AvailabilityWindowPage() {
  const { venue_id } = useParams();

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [blocks, setBlocks] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [availStart, setAvailStart] = useState("");
  const [availEnd, setAvailEnd] = useState("");

  // create a normal block (blackout) inside the window
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");

  function tokenOrError() {
    const token = localStorage.getItem("access_token");
    if (!token) throw new Error("Login required.");
    return token;
  }

  // ✅ FIX: include Authorization header (host-only endpoint often requires this)
  async function fetchBlocks() {
    const token = tokenOrError();
    const res = await fetch(`${API_BASE}/venues/${venue_id}/availability-blocks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
    }

  function formatDate(d) {
    const date = new Date(`${d}T00:00:00`);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  function getWindowBlocks(data) {
    const pre = data.find((b) => b.start_date === MIN_DATE);
    const post = data.find((b) => b.end_date === MAX_DATE);
    return { pre, post };
  }

  async function loadBlocks() {
    setError("");
    const data = await fetchBlocks();
    setBlocks(data);

    const { pre, post } = getWindowBlocks(data);

    if (pre && post) {
      setAvailStart(pre.end_date);
      setAvailEnd(post.start_date);
    } else {
      setAvailStart("");
      setAvailEnd("");
    }
  }

  useEffect(() => {
    loadBlocks().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue_id]);

  async function deleteBlock(blockId) {
    const token = tokenOrError();
    const res = await fetch(`${API_BASE}/venues/availability-blocks/${blockId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function createBlock(start_date, end_date) {
    const token = tokenOrError();
    const res = await fetch(`${API_BASE}/venues/${venue_id}/availability-blocks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ start_date, end_date }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  async function setAvailabilityWindow() {
    setError("");
    if (!availStart || !availEnd) {
      setError("Please set both availability start and end.");
      return;
    }
    if (availStart >= availEnd) {
      setError("Invalid window: start must be before end.");
      return;
    }

    const ok = window.confirm(
      "Set availability window?\n\nOutside of this date range, guests will not be able to book."
    );
    if (!ok) return;

    setBusy(true);
    try {
      const current = blocks || [];
      const { pre, post } = getWindowBlocks(current);

      // Remove previous window blocks (if any)
      if (pre) await deleteBlock(pre.id);
      if (post) await deleteBlock(post.id);

      // Create new window blocks: block before start, and after end
      await createBlock(MIN_DATE, availStart);
      await createBlock(availEnd, MAX_DATE);

      await loadBlocks();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function clearAvailabilityWindow() {
    setError("");
    const ok = window.confirm(
      "Remove availability window?\n\nThis will make the venue bookable for any date (unless other blocks exist)."
    );
    if (!ok) return;

    setBusy(true);
    try {
      const current = blocks || [];
      const { pre, post } = getWindowBlocks(current);

      if (pre) await deleteBlock(pre.id);
      if (post) await deleteBlock(post.id);

      setAvailStart("");
      setAvailEnd("");

      await loadBlocks();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  // normal blackout block inside the window
  async function addBlackoutBlock() {
    setError("");
    if (!blockStart || !blockEnd) {
      setError("Please set both blackout start and end.");
      return;
    }

    if (blockStart >= blockEnd) {
      setError("Invalid blackout: start must be before end.");
      return;
    }

    if (windowSet) {
      if (blockStart < availStart || blockEnd > availEnd) {
        setError("Blackout must be inside the availability window.");
        return;
      }
    }

    const ok = window.confirm(
      "Add blackout block?\n\nGuests will NOT be able to book during this range."
    );
    if (!ok) return;

    setBusy(true);
    try {
      await createBlock(blockStart, blockEnd);
      setBlockStart("");
      setBlockEnd("");
      await loadBlocks();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const windowSet =
    blocks &&
    blocks.some((b) => b.start_date === MIN_DATE) &&
    blocks.some((b) => b.end_date === MAX_DATE);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <a href={`/my-venues/${venue_id}`}>← Back to manage venue</a>{" "}
        <span style={{ margin: "0 10px" }}>|</span>
        <a href="/venues">Venues</a>{" "}
        <span style={{ margin: "0 10px" }}>|</span>
        <a href="/my-bookings">My bookings</a>
      </div>

      <h1>Availability window</h1>

      {error && (
        <div style={{ color: "crimson", marginBottom: 12, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          maxWidth: 560,
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <b>Status:</b>{" "}
          {windowSet ? "Restricted to a date range ✅" : "Always available (default) ✅"}
        </div>

        <label style={{ display: "block", marginBottom: 10 }}>
          Availability start
          <input
            type="date"
            value={availStart}
            onChange={(e) => setAvailStart(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 10 }}>
          Availability end
          <input
            type="date"
            value={availEnd}
            onChange={(e) => setAvailEnd(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={setAvailabilityWindow} disabled={busy} style={{ padding: 10 }}>
            {busy ? "Saving..." : "Set window"}
          </button>
          <button onClick={clearAvailabilityWindow} disabled={busy} style={{ padding: 10 }}>
            {busy ? "Working..." : "Remove window"}
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Default is always available. Setting a window blocks all dates outside the selected range.
        </div>
      </div>

      <h2 style={{ marginTop: 22 }}>Blackout dates (inside the window)</h2>
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          maxWidth: 560,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
          Use this to block vacations/maintenance days within your availability window.
          (Only the venue owner can edit blocks.)
        </div>

        <label style={{ display: "block", marginBottom: 10 }}>
          Blackout start
          <input
            type="date"
            value={blockStart}
            onChange={(e) => setBlockStart(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 10 }}>
          Blackout end
          <input
            type="date"
            value={blockEnd}
            onChange={(e) => setBlockEnd(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <button onClick={addBlackoutBlock} disabled={busy} style={{ padding: 10 }}>
          {busy ? "Adding..." : "Add blackout block"}
        </button>
      </div>

      <h2 style={{ marginTop: 22 }}>All blocks (debug)</h2>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
        The window uses two special blocks (1900-01-01 and 2100-01-01).
      </div>

      {blocks === null ? (
        <div>Loading...</div>
      ) : blocks.length === 0 ? (
        <div>No blocks.</div>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {blocks.map((b) => (
            <li key={b.id} style={{ marginBottom: 6 }}>
              {formatDate(b.start_date)} - {formatDate(b.end_date)}{" "}
              {b.start_date === MIN_DATE || b.end_date === MAX_DATE ? "(window)" : "(blackout)"}

              {b.start_date !== MIN_DATE && b.end_date !== MAX_DATE && (
                <button
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await deleteBlock(b.id);
                      await loadBlocks();
                    } catch (e) {
                      setError(e?.message || String(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  style={{ marginLeft: 10 }}
                >
                  delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}