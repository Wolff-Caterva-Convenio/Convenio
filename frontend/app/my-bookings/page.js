"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function formatCents(amount, currency) {
  if (typeof amount !== "number") return "";
  const value = amount / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
  }).format(value);
}

export default function MyBookingsPage() {
  const router = useRouter();

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadBookings() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login?next=/my-bookings");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/venues/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();
      setBookings(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings().catch((e) => {
      setError(e?.message || String(e));
      setBookings([]);
      setLoading(false);
    });
  }, [API_BASE]);

  async function cancelBooking(id) {
    const token = localStorage.getItem("access_token");

    const ok = window.confirm(
      "Cancel this booking?\n\nThe reservation will be cancelled and any refund will be sent to your payment method according to our Terms & Conditions."
    );
    if (!ok) return;

    setBusyId(id);
    setError("");

    try {
      const r1 = await fetch(`${API_BASE}/payments/bookings/${id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r1.ok) throw new Error(await r1.text());

      const r2 = await fetch(
        `${API_BASE}/payments/bookings/${id}/cancel/confirm`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!r2.ok) throw new Error(await r2.text());

      await loadBookings();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          maxWidth: 1100,
          margin: "40px auto",
          padding: "0 20px",
          fontFamily: "system-ui",
        }}
      >
        <div>Loading bookings...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main
        style={{
          maxWidth: 1100,
          margin: "40px auto",
          padding: "0 20px",
          fontFamily: "system-ui",
        }}
      >
        <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{error}</div>
      </main>
    );
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
      <h1 style={{ marginTop: 0, marginBottom: 24 }}>My bookings</h1>

      {bookings.length === 0 ? <p>No bookings yet.</p> : null}

      {bookings.map((b) => (
        <div
          key={b.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 14,
            marginTop: 14,
            maxWidth: 720,
            background: "white",
          }}
        >
          <div>
            <strong>Status:</strong> {b.status}
          </div>
          <div>
            <strong>Check-in:</strong> {b.check_in}
          </div>
          <div>
            <strong>Check-out:</strong> {b.check_out}
          </div>
          <div>
            <strong>Total:</strong>{" "}
            {formatCents(b.amount_guest_total, b.currency)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Booking ID: {b.id}
          </div>

          {b.status === "CONFIRMED" ? (
            <button
              onClick={() => cancelBooking(b.id)}
              disabled={busyId === b.id}
              style={{
                marginTop: 10,
                padding: "8px 12px",
                background: "#b91c1c",
                color: "white",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
              }}
            >
              {busyId === b.id ? "Cancelling..." : "Cancel booking"}
            </button>
          ) : null}
        </div>
      ))}
    </main>
  );
}