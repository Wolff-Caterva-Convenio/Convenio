"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const search = useSearchParams();

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const rawNext = search.get("next") || "/me";
  const next = rawNext.startsWith("/") ? rawNext : "/me";

  async function handleSubmit(e) {
    e.preventDefault();
    if (loggingIn) return;

    setError("");
    setLoggingIn(true);

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      let data = null;
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (!res.ok) {
          throw new Error(text || "Login failed");
        }
        throw new Error("Unexpected login response from server.");
      }

      if (!res.ok) {
        throw new Error(data?.detail || "Login failed");
      }

      if (!data?.access_token) {
        throw new Error("Login succeeded but no access token was returned.");
      }

      localStorage.setItem("access_token", data.access_token);
      window.location.href = next;
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setLoggingIn(false);
    }
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
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ marginTop: 0, marginBottom: 24 }}>Login</h1>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              required
              disabled={loggingIn}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6, boxSizing: "border-box" }}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              required
              disabled={loggingIn}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6, boxSizing: "border-box" }}
            />
          </label>

          <button type="submit" disabled={loggingIn} style={{ padding: 10 }}>
            {loggingIn ? "Logging in..." : "Login"}
          </button>
        </form>

        {error ? (
          <div style={{ color: "crimson", marginTop: 12, whiteSpace: "pre-wrap" }}>
            {error}
          </div>
        ) : null}
      </div>
    </main>
  );
}