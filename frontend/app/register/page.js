"use client";

import { useMemo, useState } from "react";

export default function RegisterPage() {
  const API_BASE = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000";
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`Register failed (${res.status}): ${text}`);

      const data = JSON.parse(text);
      setMsg(`Registered: ${data.email}`);
      setPassword("");

      window.location.href = "/login";
    } catch (e) {
      setErr(e?.message || "Register failed");
    } finally {
      setLoading(false);
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
        <h1 style={{ marginTop: 0, marginBottom: 24 }}>Register</h1>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label>
            Password (min 8 chars)
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={8}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <button disabled={loading} style={{ padding: 10 }}>
            {loading ? "Creating..." : "Create account"}
          </button>

          {msg && <div style={{ color: "green" }}>{msg}</div>}
          {err && <div style={{ color: "crimson" }}>{err}</div>}
        </form>

        <p style={{ marginTop: 16 }}>
          <a href="/login">Go to Login</a>
        </p>
      </div>
    </main>
  );
}