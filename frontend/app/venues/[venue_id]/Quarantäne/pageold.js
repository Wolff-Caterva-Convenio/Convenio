"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import VenueGallery from "../../components/VenueGallery";

export default function VenuePage() {
  const params = useParams();
  const router = useRouter();
  const venueId = params?.venue_id;

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [venue, setVenue] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [acceptRules, setAcceptRules] = useState(false);
  const [unavailableRanges, setUnavailableRanges] = useState([]);

  function getToken() {
    return localStorage.getItem("access_token");
  }

  function toDate(s) {
    if (!s) return null;
    const d = new Date(`${s}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

function nightsBetween(checkInStr, checkOutStr) {
  const a = toDate(checkInStr);
  const b = toDate(checkOutStr);
  if (!a || !b) return 0;
  const ms = b.getTime() - a.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
}

function overlapsUnavailable(checkInStr, checkOutStr) {
  const a = toDate(checkInStr);
  const b = toDate(checkOutStr);
  if (!a || !b) return false;

  for (const r of unavailableRanges) {
    const s = toDate(r.start);
    const e = toDate(r.end);
    if (!s || !e) continue;

    if (a < e && b > s) {
      return true;
    }
  }

  return false;
}

function centsToEur(cents) {
  if (typeof cents !== "number") return "0.00";
  return (cents / 100).toFixed(2);
}

function guestPriceFromNet(netCents) {
  if (typeof netCents !== "number") return 0;
  return Math.round(netCents / 0.83);
}

async function loadMeIfLoggedIn() {
  const token = getToken();
  if (!token) {
    setMe(null);
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      setMe(null);
      return null;
    }

    const data = await res.json();
    setMe(data);
    return data;
  } catch {
    setMe(null);
    return null;
  }
}

async function loadVenue(meData) {
  setError("");
  setLoading(true);

  try {
    if (!venueId) {
      setVenue(null);
      return;
    }

    const res = await fetch(`${API_BASE}/venues/${venueId}`, {
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      setVenue(data);
      return;
    }

    const token = getToken();
    if (token && meData) {
      const mineRes = await fetch(`${API_BASE}/venues/mine`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!mineRes.ok) {
        throw new Error(await mineRes.text());
      }

      const mineList = await mineRes.json();
      const mineFound = Array.isArray(mineList)
        ? mineList.find((x) => String(x.id) === String(venueId))
        : null;

      if (mineFound) {
        setVenue(mineFound);
        return;
      }
    }

    const text = await res.text();
    throw new Error(text || "Venue not found.");
  } catch (e) {
    setError(e?.message || String(e));
    setVenue(null);
  } finally {
    setLoading(false);
  }
}

  if (!venue) {
    return (
      <main
        style={{
          maxWidth: 1100,
          margin: "40px auto",
          padding: "0 20px",
          fontFamily: "system-ui",
        }}
      >
        <div>Venue not found.</div>
        <div style={{ marginTop: 16 }}>
          <Link href="/venues">← Back to venues</Link>
        </div>
      </main>
    );
  }

  const isHost = Boolean(
    venue && me && venue.host_user_id && String(me.id) === String(venue.host_user_id)
  );

  const nights = nightsBetween(checkIn, checkOut);

  const netPerNight = Number(venue?.payout_net_per_night ?? 0);
  const guestPerNight = guestPriceFromNet(netPerNight);
  const platformPerNight = guestPerNight - netPerNight;

  const guestTotal = guestPerNight * (nights || 0);
  const netTotal = netPerNight * (nights || 0);
  const platformTotal = platformPerNight * (nights || 0);

  const images = Array.isArray(venue.images) ? venue.images : [];

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <Link href="/venues">← Back to venues</Link>
      </div>

      {error ? (
        <div style={{ color: "crimson", marginBottom: 16, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 16,
          overflow: "hidden",
          background: "white",
          marginBottom: 24,
        }}
      >
        <VenueGallery
          title={venue.title}
          apiBase={API_BASE}
          coverImageUrl={venue.cover_image_url}
          legacyImageUrl={venue.image_url}
          images={images}
        />

        <div style={{ padding: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 0.95fr)",
              gap: 24,
            }}
          >
            <div>
              <h1 style={{ marginTop: 0, marginBottom: 10 }}>{venue.title}</h1>

              <div style={{ marginBottom: 8 }}>
                {venue.city} — cap {venue.capacity}
              </div>

              {(venue.venue_category || venue.venue_type) ? (
                <div style={{ marginBottom: 16, fontSize: 14, opacity: 0.85 }}>
                  {venue.venue_category ? (
                    <div>
                      Category: <b>{venue.venue_category}</b>
                    </div>
                  ) : null}
                  {venue.venue_type ? (
                    <div>
                      Type: <b>{venue.venue_type}</b>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div
                style={{
                  marginBottom: 20,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                }}
              >
                {venue.description || "No description yet."}
              </div>

              {venue.rules_and_restrictions ? (
                <div
                  style={{
                    marginTop: 20,
                    padding: 16,
                    border: "1px solid #eee",
                    borderRadius: 12,
                    background: "#fafafa",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>Rules & restrictions</h3>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {venue.rules_and_restrictions}
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <div
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 14,
                  padding: 16,
                  position: "sticky",
                  top: 20,
                  background: "white",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>
                  Booking
                </div>

                <div style={{ marginBottom: 8 }}>
                  Guest price per night: <b>€{centsToEur(guestPerNight)}</b>
                </div>

                <div style={{ marginBottom: 8, fontSize: 14, opacity: 0.8 }}>
                  Host net payout per night: €{centsToEur(netPerNight)}
                </div>

                <div style={{ marginBottom: 8, fontSize: 14, opacity: 0.8 }}>
                  Platform fee per night: €{centsToEur(platformPerNight)}
                </div>

                <div style={{ marginBottom: 14, fontSize: 14 }}>
                  Minimum nights: <b>{venue.minimum_nights ?? 1}</b>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6 }}>
                    Check-in
                  </label>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    disabled={busy || isHost}
                    style={{
                      width: "100%",
                      padding: 10,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6 }}>
                    Check-out
                  </label>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    disabled={busy || isHost}
                    style={{
                      width: "100%",
                      padding: 10,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 12, fontSize: 14 }}>
                  Nights: <b>{nights}</b>
                </div>

                <div
                  style={{
                    marginBottom: 14,
                    padding: 12,
                    border: "1px solid #eee",
                    borderRadius: 10,
                    background: "#fafafa",
                    fontSize: 14,
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    Guest total: <b>€{centsToEur(guestTotal)}</b>
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    Host net total: €{centsToEur(netTotal)}
                  </div>
                  <div>
                    Platform fee total: €{centsToEur(platformTotal)}
                  </div>
                </div>

                <label
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    marginBottom: 14,
                    fontSize: 14,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={acceptRules}
                    onChange={(e) => setAcceptRules(e.target.checked)}
                    disabled={busy || isHost}
                    style={{ marginTop: 2 }}
                  />
                  <span>I accept the venue rules and GTC.</span>
                </label>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={bookAndPay}
                    disabled={busy || isHost}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: isHost ? "#f5f5f5" : "white",
                      cursor: isHost ? "not-allowed" : "pointer",
                    }}
                  >
                    {busy ? "Working..." : isHost ? "You are the host" : "Book & pay"}
                  </button>

                  <button
                    onClick={messageHost}
                    disabled={busy}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "white",
                    }}
                  >
                    {busy ? "Working..." : "Message host"}
                  </button>
                </div>

                <div style={{ marginTop: 14, fontSize: 13, color: "#666" }}>
                  Status: <b>{venue.status || "—"}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}