"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function formatCents(amount, currency) {
  if (typeof amount !== "number") return "";
  const value = amount / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
  }).format(value);
}

function getToken() {
  const token = localStorage.getItem("access_token");
  if (!token) throw new Error("Login required.");
  return token;
}

export default function MyVenuesBookingsPage() {
  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const searchParams = useSearchParams();
  const venueFilter = searchParams.get("venue_id"); // optional

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);

  async function fetchJson(url, { auth = false } = {}) {
    const headers = {};
    if (auth) {
      const token = getToken();
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  useEffect(() => {
    (async () => {
      setError("");
      setLoading(true);

      try {
        // 1) Me
        const meData = await fetchJson(`${API_BASE}/me`, { auth: true });
        setMe(meData);

        // 2) My venues (client-side filter)
        const allVenues = await fetchJson(`${API_BASE}/venues`);
        const myVenuesAll = allVenues.filter((v) => v.host_user_id === meData.id);

        // Apply optional venue filter from query string
        const myVenues = venueFilter
          ? myVenuesAll.filter((v) => String(v.id) === String(venueFilter))
          : myVenuesAll;

        // 3) Bookings per venue
        const bookingsPerVenue = await Promise.all(
          myVenues.map(async (v) => {
            const bookings = await fetchJson(`${API_BASE}/venues/${v.id}/bookings`, { auth: true });
            return { venue: v, bookings: Array.isArray(bookings) ? bookings : [] };
          })
        );

        // 4) Resolve guest emails
        const guestIds = new Set();
        for (const { bookings } of bookingsPerVenue) {
          for (const b of bookings) if (b.guest_user_id) guestIds.add(b.guest_user_id);
        }

        const emailById = {};
        await Promise.all(
          Array.from(guestIds).map(async (uid) => {
            try {
              const u = await fetchJson(`${API_BASE}/users/${uid}`, { auth: true });
              emailById[uid] = u.email || String(uid);
            } catch {
              emailById[uid] = String(uid);
            }
          })
        );

        // 5) Normalize
        const normalized = [];
        for (const { venue, bookings } of bookingsPerVenue) {
          for (const b of bookings) {
            normalized.push({
              booking_id: b.id,
              status: b.status,
              check_in: b.check_in,
              check_out: b.check_out,
              venue_id: venue.id,
              venue_title: venue.title,
              venue_city: venue.city,
              guest_email: emailById[b.guest_user_id] || String(b.guest_user_id),
              amount_guest_total: b.amount_guest_total,
              amount_host_payout: b.amount_host_payout,
              currency: b.currency,
            });
          }
        }

        normalized.sort((a, b) => {
          const da = String(a.check_in || "");
          const db = String(b.check_in || "");
          if (da < db) return -1;
          if (da > db) return 1;
          return String(a.venue_title).localeCompare(String(b.venue_title));
        });

        setRows(normalized);
      } catch (e) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [API_BASE, venueFilter]);

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", fontFamily: "system-ui", padding: "0 16px" }}>
      <h1>My venues → All bookings</h1>

      <div style={{ marginTop: 10, marginBottom: 14 }}>
        <a href="/my-venues">← Back to My venues</a>
        {venueFilter && (
          <span style={{ marginLeft: 12, fontSize: 12, opacity: 0.75 }}>
            (Filtered to one venue)
          </span>
        )}
      </div>

      {me && (
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
          Logged in as: <b>{me.email}</b>
        </div>
      )}

      {error && (
        <div style={{ padding: 12, border: "1px solid #f3b4b4", background: "#fff5f5", color: "crimson", borderRadius: 10 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div>No bookings found across your venues.</div>
      ) : (
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1050 }}>
            <thead>
              <tr>
                {["Check-in", "Check-out", "Status", "Venue", "Guest email", "Total", "Host payout", "Booking ID"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd", fontSize: 13 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.booking_id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.check_in}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.check_out}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.status}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                    <div style={{ fontWeight: 600 }}>{r.venue_title}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{r.venue_city}</div>
                    {/* NEW: link back to the host venue page */}
                    <div style={{ marginTop: 6 }}>
                      <a href={`/my-venues/${r.venue_id}`} style={{ fontSize: 12 }}>
                        Manage venue
                      </a>
                    </div>
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.guest_email}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                    {r.amount_guest_total != null ? formatCents(r.amount_guest_total, r.currency) : ""}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>
                    {r.amount_host_payout != null ? formatCents(r.amount_host_payout, r.currency) : ""}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee", fontSize: 12, opacity: 0.75 }}>
                    {r.booking_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}