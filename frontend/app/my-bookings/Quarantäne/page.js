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

  async function loadBookings() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login?next=/my-bookings");
      return;
    }

    setError("");

    const res = await fetch(`${API_BASE}/venues/my-bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(await res.text());
    setBookings(await res.json());
  }

  useEffect(() => {
    loadBookings().catch((e) => setError(e.message || String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      const r2 = await fetch(`${API_BASE}/payments/bookings/${id}/cancel/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r2.ok) throw new Error(await r2.text());

      await loadBookings();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <div style={{ padding: 20, color: "crimson" }}>{error}</div>;
  if (!bookings) return <div style={{ padding: 20 }}>Loading bookings...</div>;

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>My bookings</h1>

      {bookings.length === 0 && <p>No bookings yet.</p>}

      {bookings.map((b) => (
        <div
          key={b.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: 14,
            marginTop: 14,
          }}
        >
          <div><strong>Status:</strong> {b.status}</div>
          <div><strong>Check-in:</strong> {b.check_in}</div>
          <div><strong>Check-out:</strong> {b.check_out}</div>
          <div><strong>Total:</strong> {formatCents(b.amount_guest_total, b.currency)}</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>Booking ID: {b.id}</div>

          {b.status === "CONFIRMED" && (
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
          )}
        </div>
      ))}
    </main>
  );
}