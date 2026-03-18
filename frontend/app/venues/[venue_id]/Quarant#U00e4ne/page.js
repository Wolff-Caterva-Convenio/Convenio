"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

export default function VenueDetailPage() {
  const { venue_id } = useParams();

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000",
    []
  );

  const [venue, setVenue] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [acceptRules, setAcceptRules] = useState(false);

  function getToken() {
    return localStorage.getItem("access_token");
  }

  async function loadMeIfLoggedIn() {
    const token = getToken();
    if (!token) {
      setMe(null);
      return;
    }

    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setMe(null);
      return;
    }

    setMe(await res.json());
  }

  async function loadVenue() {
    setVenue(null);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/venues`);
      if (!res.ok) throw new Error(await res.text());
      const list = await res.json();
      const found = list.find((x) => x.id === venue_id);
      setVenue(found || null);
    } catch {
      setVenue(null);
    }
  }

  useEffect(() => {
    loadVenue().catch(() => {});
    loadMeIfLoggedIn().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venue_id]);

  async function bookAndPay() {
    setError("");

    const token = getToken();
    if (!token) {
      setError("Please login as a guest before booking.");
      return;
    }

    if (!checkIn || !checkOut) {
      setError("Please select both check-in and check-out dates.");
      return;
    }

    if (!acceptRules) {
      setError("Please accept venue rules + GTC before paying.");
      return;
    }

    setBusy(true);
    try {
      const bookingRes = await fetch(`${API_BASE}/venues/${venue_id}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          check_in: checkIn,
          check_out: checkOut,
        }),
      });

      if (!bookingRes.ok) throw new Error(await bookingRes.text());
      const booking = await bookingRes.json();

      const checkoutRes = await fetch(`${API_BASE}/payments/stripe/checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ booking_id: booking.id, accept_rules_and_gtc: acceptRules }),
      });

      if (!checkoutRes.ok) throw new Error(await checkoutRes.text());
      const checkout = await checkoutRes.json();

      if (!checkout.checkout_url) throw new Error("Missing checkout_url from backend.");
      window.location.href = checkout.checkout_url;
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function contactHost() {
    setError("");
    const token = getToken();
    if (!token) {
      setError("Please login before contacting the host.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/threads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ venue_id }),
      });

      if (!res.ok) throw new Error(await res.text());
      const thread = await res.json();

      window.location.href = `/threads/${thread.id}`;
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const isHost = Boolean(venue && me && venue.host_user_id && me.id === venue.host_user_id);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <a href="/venues">← Back to venues</a>{" "}
        <span style={{ margin: "0 10px" }}>|</span>
        <a href="/my-bookings">My bookings</a>{" "}
        <span style={{ margin: "0 10px" }}>|</span>
        <a href="/threads">Inbox</a>{" "}
        {isHost ? (
          <>
            <span style={{ margin: "0 10px" }}>|</span>
            <a href={`/venues/${venue_id}/availability`}>Manage availability (host)</a>
          </>
        ) : (
          <>
            <span style={{ margin: "0 10px" }}>|</span>
            <span style={{ fontSize: 12, opacity: 0.65 }}>Host tools hidden</span>
          </>
        )}
      </div>

      <h1>Venue</h1>

      {venue ? (
        <div style={{ marginBottom: 14 }}>
          <div><b>{venue.title}</b></div>
          <div>{venue.city} — cap {venue.capacity}</div>
          <div>Net per night: €{(venue.payout_net_per_night / 100).toFixed(2)}</div>
        </div>

        {venue.rules_and_restrictions && (
          <div style={{ marginBottom: 14, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Rules & Restrictions</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{venue.rules_and_restrictions}</div>
          </div>
        )}
      ) : (
        <div style={{ marginBottom: 14, opacity: 0.8 }}>
          Venue ID: <code>{venue_id}</code>
        </div>
      )}

      {error && (
        <div style={{ color: "crimson", marginBottom: 12, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button onClick={contactHost} disabled={busy} style={{ padding: 10 }}>
          {busy ? "Working..." : "Contact host"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        <label>
          Check-in
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Check-out
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={acceptRules}
            onChange={(e) => setAcceptRules(e.target.checked)}
            disabled={busy}
            style={{ marginTop: 3 }}
          />
          <span>
            I have read and accept venue rules + GTC.
          </span>
        </label>

        <button onClick={bookAndPay} disabled={busy || !acceptRules} style={{ padding: 10 }}>
          {busy ? "Starting checkout..." : "Book & pay"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          If you get “Dates are blocked by the host”, the host restricted availability.
        </div>
      </div>
    </main>
  );
}