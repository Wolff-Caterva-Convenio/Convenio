"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
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
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dateError, setDateError] = useState(""); // ← NEW: live feedback for dates

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [acceptRules, setAcceptRules] = useState(false);
  const [unavailableRanges, setUnavailableRanges] = useState([]);
  const [range, setRange] = useState();

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
      if (a < e && b > s) return true;
    }
    return false;
  }

  function isDateDisabled(date) {
    for (const r of unavailableRanges) {
      const start = toDate(r.start);
      const end = toDate(r.end);
      if (!start || !end) continue;

      if (date >= start && date < end) {
        return true;
      }
    }
    return false;
  }

  function isRangeTooShort(from, to) {
    if (!from || !to) return false;

    const ms = to.getTime() - from.getTime();
    const nights = Math.round(ms / (1000 * 60 * 60 * 24));

    const min = venue?.minimum_nights ?? 1;
    return nights < min;
  }

  // ← NEW: Live validation (prevents the screenshot bug)
  const isRangeInvalid = useMemo(() => {
    if (!checkIn || !checkOut) return false;
    const nights = nightsBetween(checkIn, checkOut);
    const minNights = venue?.minimum_nights ?? 1;
    return overlapsUnavailable(checkIn, checkOut) || nights < minNights;
  }, [checkIn, checkOut, unavailableRanges, venue]);

  function centsToEur(cents) {
    if (typeof cents !== "number") return "0.00";
    return (cents / 100).toFixed(2);
  }

  function formatDate(d) {
    const date = new Date(`${d}T00:00:00`);
    if (Number.isNaN(date.getTime())) return d;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
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
        if (!mineRes.ok) throw new Error(await mineRes.text());

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
    }
  }

  // Improved availability load – now with proper error (no silent fail)
  async function loadAvailability() {
    if (!venueId) return;

    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const future = new Date();
    future.setFullYear(future.getFullYear() + 3);
    const end = future.toISOString().slice(0, 10);

    const url = `${API_BASE}/venues/${venueId}/availability?start=${start}&end=${end}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text();
        console.error(`Availability load failed (${res.status}): ${text}`);
        throw new Error(text || `Availability load failed (${res.status})`);
      }
      const data = await res.json();
      const ranges = (data.unavailable || []).map((r) => ({
        start: r.start,
        end: r.end,
      }));
      setUnavailableRanges(ranges);
      setDateError(""); // clear any previous date error
    } catch (e) {
      console.error("Availability fetch error:", e);
      setUnavailableRanges([]); // keep graceful fallback
      // We do NOT set a global error – availability failure should not hide the whole venue
    } finally {
      setAvailabilityLoading(false);
    }
  }

  useEffect(() => {
    async function run() {
      setLoading(true);
      setAvailabilityLoading(true);
      setError("");
      setDateError("");

      try {
        const meData = await loadMeIfLoggedIn();
        await loadVenue(meData);
        await loadAvailability();
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [venueId, API_BASE]);

  useEffect(() => {
    if (!range?.from) {
      setCheckIn("");
      setCheckOut("");
      return;
    }

    const from = range.from.toISOString().slice(0, 10);
    setCheckIn(from);

    if (range.to) {
      const to = range.to.toISOString().slice(0, 10);
      setCheckOut(to);
    } else {
      setCheckOut("");
    }

    setDateError("");
  }, [range]);

  async function bookAndPay() {
    setError("");
    setDateError("");

    const token = getToken();
    if (!token) {
      router.push(`/login?next=/venues/${venueId}`);
      return;
    }
    if (!venue) {
      setError("Venue not found.");
      return;
    }
    if (!checkIn || !checkOut) {
      setError("Please select both check-in and check-out dates.");
      return;
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights <= 0) {
      setError("Check-out must be after check-in.");
      return;
    }
    if (venue.minimum_nights && nights < venue.minimum_nights) {
      setError(`Minimum stay is ${venue.minimum_nights} night(s).`);
      return;
    }
    if (overlapsUnavailable(checkIn, checkOut)) {
      setError("Selected dates are not available.");
      return;
    }
    if (!acceptRules) {
      setError("Please accept venue rules + GTC before paying.");
      return;
    }

    setBusy(true);
    try {
      const bookingRes = await fetch(`${API_BASE}/venues/${venueId}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ check_in: checkIn, check_out: checkOut }),
      });
      if (!bookingRes.ok) throw new Error(await bookingRes.text());
      const booking = await bookingRes.json();

      try {
        const checkoutRes = await fetch(`${API_BASE}/payments/stripe/checkout-session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            booking_id: booking.id,
            accept_rules_and_gtc: acceptRules,
          }),
        });
        if (!checkoutRes.ok) throw new Error(await checkoutRes.text());
        const checkout = await checkoutRes.json();
        if (!checkout.checkout_url) throw new Error("Missing checkout_url from backend.");

        window.location.href = checkout.checkout_url;

      } catch (paymentError) {
        // Cleanup booking if payment step fails
        try {
          await fetch(`${API_BASE}/venues/bookings/${booking.id}/cancel`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (cleanupError) {
          console.error("Cleanup failed:", cleanupError);
        }

        throw paymentError;
      }

    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function messageHost() {
    setError("");
    const token = getToken();
    if (!token) {
      router.push(`/login?next=/venues/${venueId}`);
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
        body: JSON.stringify({ venue_id: venueId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const thread = await res.json();
      if (!thread?.id) throw new Error("Thread creation succeeded but no thread id was returned.");
      window.location.href = `/threads/${thread.id}`;
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui" }}>
        <div>Loading venue...</div>
      </main>
    );
  }

  if (error && !venue) {
    return (
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui" }}>
        <h1 style={{ marginBottom: 12 }}>Venue</h1>
        <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{error}</div>
        <div style={{ marginTop: 16 }}>
          <Link href="/venues">← Back to venues</Link>
        </div>
      </main>
    );
  }

  if (!venue) {
    return (
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui" }}>
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

  const minCheckoutDate =
    checkIn && venue?.minimum_nights
      ? (() => {
          const d = toDate(checkIn);
          d.setDate(d.getDate() + venue.minimum_nights);
          return d.toISOString().slice(0, 10);
        })()
      : checkIn
      ? (() => {
          const d = toDate(checkIn);
          d.setDate(d.getDate() + 1);
          return d.toISOString().slice(0, 10);
        })()
      : "";

  const netPerNight = Number(venue?.payout_net_per_night ?? 0);
  const guestPerNight = guestPriceFromNet(netPerNight);
  const platformPerNight = guestPerNight - netPerNight;

  const guestTotal = guestPerNight * (nights || 0);
  const netTotal = netPerNight * (nights || 0);
  const platformTotal = platformPerNight * (nights || 0);

  const images = Array.isArray(venue.images) ? venue.images : [];

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/venues">← Back to venues</Link>
      </div>

      {error ? (
        <div style={{ color: "crimson", marginBottom: 16, whiteSpace: "pre-wrap" }}>{error}</div>
      ) : null}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 16,
          overflow: "visible",
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
              gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 0.95fr)",
              gap: 24,
            }}
          >
            {/* left column (venue info) unchanged */}
            <div>
              <h1 style={{ marginTop: 0, marginBottom: 10 }}>{venue.title}</h1>
              <div style={{ marginBottom: 8 }}>
                {venue.city} — cap {venue.capacity}
              </div>
              {(venue.venue_category || venue.venue_type) && (
                <div style={{ marginBottom: 16, fontSize: 14, opacity: 0.85 }}>
                  {venue.venue_category && <div>Category: <b>{venue.venue_category}</b></div>}
                  {venue.venue_type && <div>Type: <b>{venue.venue_type}</b></div>}
                </div>
              )}
              <div style={{ marginBottom: 20, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {venue.description || "No description yet."}
              </div>
              {venue.rules_and_restrictions && (
                <div style={{ marginTop: 20, padding: 16, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
                  <h3 style={{ marginTop: 0 }}>Rules & restrictions</h3>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {venue.rules_and_restrictions}
                  </div>
                </div>
              )}
            </div>

            {/* right column – Booking sidebar */}
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
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Booking</div>

                {availabilityLoading && (
                  <div style={{ padding: 12, background: "#fafafa", borderRadius: 10, marginBottom: 12, fontSize: 14 }}>
                    Loading availability...
                  </div>
                )}

                {/* price info unchanged */}
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

                {unavailableRanges.length > 0 && (
                  <div style={{ marginBottom: 14, padding: 12, border: "1px solid #eee", borderRadius: 10, background: "#fafafa", fontSize: 13 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Unavailable dates</div>
                    <div style={{ lineHeight: 1.4 }}>
                      {unavailableRanges.map((r, i) => (
                        <div key={i}>
                          {formatDate(r.start)} → {formatDate(r.end)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6 }}>
                    Select stay
                  </label>
                  <div
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: 12,
                      background: availabilityLoading || isHost ? "#fafafa" : "white",
                      opacity: availabilityLoading || isHost ? 0.7 : 1,
                      pointerEvents: availabilityLoading || busy || isHost ? "none" : "auto",
                    }}
                  >
                    <DayPicker
                      mode="range"
                      selected={range}
                      onSelect={(r) => {
                        if (!r?.from) {
                          setRange(undefined);
                          return;
                        }

                        const min = venue?.minimum_nights ?? 1;

                        // Only auto-fill if min nights > 1
                        if (!r.to && min > 1) {
                          const from = new Date(r.from);
                          const to = new Date(from);
                          to.setDate(to.getDate() + min);

                          if (
                            overlapsUnavailable(
                              from.toISOString().slice(0, 10),
                              to.toISOString().slice(0, 10)
                            )
                          ) {
                            setDateError("Selected start date cannot fulfill minimum stay.");
                            return;
                          }

                          setDateError("");
                          setRange({ from, to });
                          return;
                        }

                        // Normal behavior for min = 1 OR second click
                        if (r.to && isRangeTooShort(r.from, r.to)) {
                          setDateError(`Minimum stay is ${min} night(s)`);
                          return;
                        }

                        setDateError("");
                        setRange(r);
                      }}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);

                        return date < today || isDateDisabled(date);
                      }}
                      modifiers={{
                        unavailable: (date) => isDateDisabled(date),
                      }}
                      modifiersStyles={{
                        unavailable: {
                          backgroundColor: "#ffe6e6",
                          color: "#cc0000",
                          textDecoration: "line-through",
                        },
                      }}
                      numberOfMonths={2}
                    />
                  </div>
                </div>

                {/* Live validation feedback (prevents the "Kackhaus" screenshot bug) */}
                {dateError && (
                  <div style={{ color: "crimson", fontSize: 14, marginBottom: 12 }}>{dateError}</div>
                )}
                {isRangeInvalid && checkIn && checkOut && (
                  <div style={{ color: "crimson", fontSize: 14, marginBottom: 12 }}>
                    Selected dates are not available or below minimum stay.
                  </div>
                )}

                <div style={{ marginBottom: 12, fontSize: 14 }}>
                  Nights: <b>{nights}</b>
                  {venue.minimum_nights && nights > 0 && nights < venue.minimum_nights && (
                    <div style={{ color: "orange", marginTop: 6 }}>
                      Minimum stay is {venue.minimum_nights} night(s)
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 14, padding: 12, border: "1px solid #eee", borderRadius: 10, background: "#fafafa", fontSize: 14 }}>
                  <div style={{ marginBottom: 6 }}>Guest total: <b>€{centsToEur(guestTotal)}</b></div>
                  <div style={{ marginBottom: 6 }}>Host net total: €{centsToEur(netTotal)}</div>
                  <div>Platform fee total: €{centsToEur(platformTotal)}</div>
                </div>

                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 14, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={acceptRules}
                    onChange={(e) => setAcceptRules(e.target.checked)}
                    disabled={busy || availabilityLoading || isHost}
                    style={{ marginTop: 2 }}
                  />
                  <span>I accept the venue rules and GTC.</span>
                </label>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={bookAndPay}
                    disabled={
                      busy ||
                      availabilityLoading ||
                      isHost ||
                      isRangeInvalid ||
                      !checkIn ||
                      !checkOut
                    }
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: isHost ? "#f5f5f5" : "white",
                      cursor: isHost || isRangeInvalid ? "not-allowed" : "pointer",
                    }}
                  >
                    {busy
                      ? "Working..."
                      : availabilityLoading
                      ? "Checking availability..."
                      : isHost
                      ? "You are the host"
                      : "Book & pay"}
                  </button>

                  <button
                    onClick={messageHost}
                    disabled={busy || availabilityLoading || isHost}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: isHost ? "#f5f5f5" : "white",
                      cursor: isHost ? "not-allowed" : "pointer",
                    }}
                  >
                    {busy ? "Working..." : isHost ? "You are the host" : "Message host"}
                  </button>
                </div>

                <div style={{ marginTop: 14, fontSize: 13, color: "#670" }}>
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