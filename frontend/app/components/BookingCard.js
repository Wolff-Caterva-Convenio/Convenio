"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useRouter } from "next/navigation";
import VenueGallery from "./VenueGallery";

export default function BookingCard({ venue, me, API_BASE }) {
  const router = useRouter();
  const venueId = venue?.id;

  // --- INTERNAL STATE ---
  const [busy, setBusy] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [unavailableRanges, setUnavailableRanges] = useState([]);
  const [range, setRange] = useState();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [acceptRules, setAcceptRules] = useState(false);
  const [dateError, setDateError] = useState("");
  const [error, setError] = useState("");

  // --- LOGIC HELPER: Is the current user the host? ---
  const isHost = useMemo(() => 
    venue && me && String(me.id) === String(venue.host_user_id), 
  [venue, me]);

  // --- BULLETPROOF HELPERS ---
  
  // Forces UTC to prevent "jumping" dates across timezones
  const toUTCDate = useCallback((s) => {
    if (!s) return null;
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }, []);

  const getNights = useCallback((start, end) => {
    const a = toUTCDate(start);
    const b = toUTCDate(end);
    if (!a || !b) return 0;
    return Math.max(0, Math.round((b - a) / 86400000));
  }, [toUTCDate]);

  const overlapsUnavailable = useCallback((startStr, endStr) => {
    const a = toUTCDate(startStr);
    const b = toUTCDate(endStr);
    if (!a || !b) return false;

    return unavailableRanges.some((r) => {
      const s = toUTCDate(r.start);
      const e = toUTCDate(r.end);
      return s && e && a < e && b > s;
    });
  }, [unavailableRanges, toUTCDate]);

  // Blocks Today and the Past
  const isDateDisabled = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date <= today) return true;

    return unavailableRanges.some((r) => {
      const s = toUTCDate(r.start);
      const e = toUTCDate(r.end);
      return s && e && date >= s && date < e;
    });
  };

  const centsToEur = (cents) => (typeof cents !== "number" ? "0.00" : (cents / 100).toFixed(2));

  const formatDate = useCallback((d) => {
    const date = toUTCDate(d);
    if (!date) return d;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }, [toUTCDate]);

  // Logic for the colored min-stay block highlight
  const minStayModifier = useMemo(() => {
    if (!range?.from) return null;
    const end = new Date(range.from);
    end.setDate(end.getDate() + (venue?.minimum_nights ?? 1) - 1);
    return { from: range.from, to: end };
  }, [range, venue]);

  // --- NEW: CENTRALIZED BOOKING GUARD ---
  // Consolidated logic for button states and interaction blocking
  const isRangeInvalid = useMemo(() => {
    if (!checkIn || !checkOut) return false;
    const nights = getNights(checkIn, checkOut);
    return overlapsUnavailable(checkIn, checkOut) || nights < (venue?.minimum_nights ?? 1);
  }, [checkIn, checkOut, overlapsUnavailable, venue, getNights]);

  const isBookingDisabled = useMemo(() => {
    return (
      busy ||
      availabilityLoading ||
      isHost ||
      isRangeInvalid ||
      !checkOut ||
      !acceptRules
    );
  }, [busy, availabilityLoading, isHost, isRangeInvalid, checkOut, acceptRules]);

  // --- THE CALENDAR BRAIN ---
  const handleSelect = (r, selectedDay) => {
    const minNights = venue?.minimum_nights ?? 1;

    // Toggle OFF logic
    if (range?.from && !range?.to && selectedDay.getTime() === range.from.getTime()) {
      clearDates();
      return;
    }
    if (range?.from && range?.to && selectedDay.getTime() === range.to.getTime()) {
        setRange({ from: range.from });
        setCheckOut("");
        return;
    }

    if (!r?.from) {
      clearDates();
      return;
    }

    // Auto-extension on first click to meet min-stay
    if (!r.to) {
      const fromDate = new Date(r.from);
      const suggestedTo = new Date(fromDate);
      suggestedTo.setDate(suggestedTo.getDate() + minNights);

      const fromStr = fromDate.toISOString().slice(0, 10);
      const toStr = suggestedTo.toISOString().slice(0, 10);

      if (overlapsUnavailable(fromStr, toStr)) {
        setRange({ from: fromDate });
        setCheckIn(fromStr);
        setCheckOut("");
        setDateError(`Min stay is ${minNights} nights, but blocked dates interfere.`);
        return;
      }

      setDateError("");
      setRange({ from: fromDate, to: suggestedTo });
      setCheckIn(fromStr);
      setCheckOut(toStr);
      return;
    }

    // Manual Range Selection
    const fromStr = r.from.toISOString().slice(0, 10);
    const toStr = r.to.toISOString().slice(0, 10);
    const nightsCount = getNights(fromStr, toStr);

    if (nightsCount <= 0) {
      setDateError("Check-out must be after check-in.");
      setRange(r);
      setCheckIn(fromStr);
      setCheckOut(toStr);
      return;
    }

    if (nightsCount < minNights) {
      setDateError(`Minimum stay is ${minNights} nights.`);
      setRange(r); 
      setCheckIn(fromStr);
      setCheckOut(toStr);
      return;
    }

    if (overlapsUnavailable(fromStr, toStr)) {
      setDateError("This selection overlaps with blocked dates.");
      return;
    }

    setDateError("");
    setRange(r);
    setCheckIn(fromStr);
    setCheckOut(toStr);
  };

  const clearDates = () => {
    setRange(undefined);
    setCheckIn("");
    setCheckOut("");
    setDateError("");
  };

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!venueId) return;
    async function loadAvailability() {
      setAvailabilityLoading(true);
      try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const startStr = tomorrow.toISOString().slice(0, 10);

        const future = new Date();
        future.setFullYear(future.getFullYear() + 3);
        
        const res = await fetch(`${API_BASE}/venues/${venueId}/availability?start=${startStr}&end=${future.toISOString().slice(0, 10)}`, {
          cache: "no-store"
        });
        if (res.ok) {
          const data = await res.json();
          setUnavailableRanges(data.unavailable || []);
        }
      } catch (err) {
        console.error("Failed to load availability", err);
      } finally {
        setAvailabilityLoading(false);
      }
    }
    loadAvailability();
  }, [venueId, API_BASE]);

  // --- PRICING LOGIC ---
  const nights = getNights(checkIn, checkOut);
  const guestPriceFromNet = (netCents) => Math.round(netCents / 0.83);

  const netPerNight = venue?.payout_net_per_night || 0;
  const guestPerNight = guestPriceFromNet(netPerNight);
  const platformPerNight = guestPerNight - netPerNight;
  
  const guestTotal = guestPerNight * nights;
  const netTotal = netPerNight * nights;
  const platformTotal = platformPerNight * nights;

  // --- ACTIONS ---
  async function bookAndPay() {
    if (busy) return;

    setError("");
    const token = localStorage.getItem("access_token");
    if (!token) return router.push(`/login?next=/venues/${venueId}`);
    if (!acceptRules) return setError("Please accept venue rules + GTC before paying.");
    
    setBusy(true);
    let bookingId = null;

    try {
      // Step 1: Create Booking
      const bRes = await fetch(`${API_BASE}/venues/${venueId}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ check_in: checkIn, check_out: checkOut }),
      });
      if (!bRes.ok) throw new Error(await bRes.text());
      const booking = await bRes.json();
      bookingId = booking.id;

      // Step 2: Stripe Session
      const sRes = await fetch(`${API_BASE}/payments/stripe/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ booking_id: bookingId, accept_rules_and_gtc: acceptRules }),
      });
      if (!sRes.ok) throw new Error(await sRes.text());
      const session = await sRes.json();

      // Defensive check for checkout_url
      if (!session.checkout_url) {
          throw new Error("Payment initialization failed: No checkout URL received.");
      }
      window.location.href = session.checkout_url;
    } catch (e) {
      setError(e.message);
      if (bookingId) {
        fetch(`${API_BASE}/venues/bookings/${bookingId}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(console.error);
      }
      setBusy(false);
    }
  }

  async function messageHost() {
    if (busy) return;

    const token = localStorage.getItem("access_token");
    if (!token) return router.push(`/login?next=/venues/${venueId}`);
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ venue_id: venueId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const thread = await res.json();
      
      // Defensive check for thread ID
      if (!thread?.id) {
          throw new Error("Could not create conversation thread.");
      }
      router.push(`/threads/${thread.id}`);
    } catch (e) {
      setError(e.message || "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <aside style={{ border: "1px solid #ddd", borderRadius: 16, padding: 24, background: "white", position: "sticky", top: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Booking</div>
      
      {availabilityLoading && (
        <div style={{ padding: 12, background: "#fafafa", borderRadius: 10, marginBottom: 12, fontSize: 14 }}>
          Loading availability...
        </div>
      )}

      {/* Per-night transparency (Regression Fix) */}
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
        Min stay: <b>{venue?.minimum_nights ?? 1} nights</b>
      </div>
      
      {/* Explicit list of unavailable dates (Regression Fix) */}
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

      {dateError && <div style={{ color: "#d93025", fontSize: 13, marginBottom: 10, fontWeight: 500 }}>⚠️ {dateError}</div>}
      {error && <div style={{ color: "red", fontSize: 13, marginBottom: 10 }}>{error}</div>}

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Select stay</label>
          {range?.from && (
            <button onClick={clearDates} style={{ fontSize: 12, color: 'blue', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 6 }}>
              Clear dates
            </button>
          )}
        </div>

        {/* Calendar Interaction Guard */}
        <div style={{ 
          border: "1px solid #eee", 
          borderRadius: 10, 
          padding: 12, 
          background: availabilityLoading || isHost || busy ? "#fafafa" : "white", 
          opacity: availabilityLoading || isHost ? 0.6 : 1,
          pointerEvents: availabilityLoading || busy || isHost ? "none" : "auto"
        }}>
          <DayPicker
            mode="range"
            selected={range}
            // Logic-level guard for onSelect (Race Condition Safety)
            onSelect={availabilityLoading || busy || isHost ? undefined : handleSelect}
            numberOfMonths={1}
            disabled={isDateDisabled}
            modifiers={{ minStay: minStayModifier }}
            modifiersStyles={{
                disabled: { 
                  textDecoration: "line-through", 
                  color: "#d93025",
                  backgroundColor: "#fff0f0",
                  cursor: "not-allowed" 
                },
                minStay: { 
                  backgroundColor: "#E6D2AA", 
                  color: "#C8993C", 
                  fontWeight: "bold" 
                }
              }}
              styles={{
                day_disabled: { opacity: 1 } 
              }}
            />
        </div>
      </div>

      <div style={{ margin: "20px 0", padding: 16, background: "#f9f9f9", borderRadius: 12, fontSize: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span>Nights:</span>
          <span style={{ fontWeight: 600 }}>{nights}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span>Host payout total:</span>
          <span>€{centsToEur(netTotal)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span>Platform fees:</span>
          <span>€{centsToEur(platformTotal)}</span>
        </div>
        <div style={{ height: "1px", background: "#ddd", margin: "8px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
          <span>Total (Guest):</span>
          <span>€{centsToEur(guestTotal)}</span>
        </div>
      </div>

      <label style={{ display: "flex", gap: 10, marginBottom: 20, fontSize: 13, cursor: "pointer", alignItems: 'flex-start' }}>
        <input 
          type="checkbox" 
          checked={acceptRules} 
          onChange={(e) => setAcceptRules(e.target.checked)} 
          disabled={availabilityLoading || isHost || busy} 
          style={{ marginTop: 3 }}
        />
        <span>I accept the venue rules and GTC.</span>
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button 
          onClick={bookAndPay} 
          disabled={isBookingDisabled}
          style={{ 
            flex: 1, padding: "12px", borderRadius: 10, 
            background: isHost ? "#eee" : "#000", 
            color: isHost ? "#999" : "#fff", 
            fontWeight: 600, border: "none", 
            cursor: isBookingDisabled ? "not-allowed" : "pointer" 
          }}
        >
          {/* Improved UX Labels */}
          {availabilityLoading 
            ? "Loading availability..." 
            : isHost 
            ? "Your Venue" 
            : busy 
            ? "Working..." 
            : "Book & Pay"}
        </button>
        <button 
          onClick={messageHost} 
          disabled={busy || availabilityLoading || isHost}
          style={{ 
            flex: 1, padding: "12px", borderRadius: 10, background: "transparent", 
            border: "1px solid #ddd", 
            cursor: (availabilityLoading || isHost) ? "not-allowed" : "pointer",
            fontWeight: 500
          }}
        >
          Message Host
        </button>
      </div>
    </aside>
  );
}