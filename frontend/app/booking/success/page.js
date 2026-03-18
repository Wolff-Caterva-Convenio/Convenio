"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

function formatCents(amountCents, currency) {
  if (typeof amountCents !== "number") return "";
  const value = amountCents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "EUR").toUpperCase(),
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${(currency || "EUR").toUpperCase()}`;
  }
}

function isFinalStatus(status) {
  const s = String(status || "").toUpperCase();
  return s !== "" && s !== "PENDING_PAYMENT" && s !== "PROCESSING";
}

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [state, setState] = useState({
    loading: true,
    error: "",
    data: null,
  });

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    async function fetchSession(retriesLeft = 15) {
      if (!sessionId) {
        if (!cancelled) {
          setState({
            loading: false,
            error: "Missing session_id in URL.",
            data: null,
          });
        }
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/payments/stripe/session/${encodeURIComponent(sessionId)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        if (!res.ok) {
          if (retriesLeft > 0) {
            timeoutId = setTimeout(() => {
              fetchSession(retriesLeft - 1);
            }, 1000);
            return;
          }

          const text = await res.text();
          throw new Error(`Backend returned HTTP ${res.status}: ${text}`);
        }

        const data = await res.json();

        if (!isFinalStatus(data?.status) && retriesLeft > 0) {
          if (!cancelled) {
            setState({
              loading: true,
              error: "",
              data,
            });
          }

          timeoutId = setTimeout(() => {
            fetchSession(retriesLeft - 1);
          }, 1000);
          return;
        }

        if (!cancelled) {
          setState({
            loading: false,
            error: "",
            data,
          });
        }
      } catch (err) {
        if (retriesLeft > 0) {
          timeoutId = setTimeout(() => {
            fetchSession(retriesLeft - 1);
          }, 1000);
          return;
        }

        if (!cancelled) {
          setState({
            loading: false,
            error: err?.message || String(err),
            data: null,
          });
        }
      }
    }

    fetchSession();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [API_BASE, sessionId]);

  const titleStyle = { fontSize: 24, fontWeight: 700, marginBottom: 12 };
  const cardStyle = {
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 16,
    maxWidth: 720,
    margin: "24px auto",
    background: "white",
  };
  const rowStyle = { display: "flex", gap: 12, margin: "8px 0" };
  const labelStyle = { width: 160, opacity: 0.8 };
  const valueStyle = {
    flex: 1,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  };
  const btnStyle = {
    display: "inline-block",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #222",
    textDecoration: "none",
    marginRight: 10,
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={cardStyle}>
        <div style={titleStyle}>Payment complete</div>

        {state.loading && (
          <div>
            Finalizing your booking confirmation…
            {state.data?.status ? (
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
                Current status: {String(state.data.status)}
              </div>
            ) : null}
          </div>
        )}

        {!state.loading && state.error && (
          <>
            <div style={{ color: "crimson", marginBottom: 12 }}>
              Could not load booking confirmation:
              <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                {state.error}
              </div>
            </div>

            <div style={{ opacity: 0.8 }}>
              Session ID:
              <div style={{ wordBreak: "break-all", marginTop: 6 }}>
                {sessionId}
              </div>
            </div>
          </>
        )}

        {!state.loading && !state.error && state.data && (
          <>
            <div style={{ marginBottom: 12 }}>
              Your booking is confirmed. ✅
            </div>

            <div style={rowStyle}>
              <div style={labelStyle}>Booking ID</div>
              <div style={valueStyle}>{state.data.booking_id}</div>
            </div>

            <div style={rowStyle}>
              <div style={labelStyle}>Status</div>
              <div style={valueStyle}>{state.data.status}</div>
            </div>

            <div style={rowStyle}>
              <div style={labelStyle}>Check-in</div>
              <div style={valueStyle}>{String(state.data.check_in)}</div>
            </div>

            <div style={rowStyle}>
              <div style={labelStyle}>Check-out</div>
              <div style={valueStyle}>{String(state.data.check_out)}</div>
            </div>

            <div style={rowStyle}>
              <div style={labelStyle}>Total paid</div>
              <div style={valueStyle}>
                {formatCents(
                  state.data.amount_guest_total ?? state.data.guest_total,
                  state.data.currency
                )}
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <a href="/my-bookings" style={btnStyle}>
                My bookings
              </a>
              <a href="/venues" style={btnStyle}>
                Browse venues
              </a>
            </div>

            <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
              Session ID (Stripe):{" "}
              <span style={{ wordBreak: "break-all" }}>{sessionId}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}