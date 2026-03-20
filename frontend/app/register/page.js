"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, TOKEN_KEY } from "../lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setBusy(true);

    try {
      const res = await apiPost("/auth/register", {
        email,
        password,
      });

      // 🔑 Case A: backend returns token directly
      if (res?.access_token) {
        localStorage.setItem(TOKEN_KEY, res.access_token);

        // notify app
        window.dispatchEvent(new Event("convenio-auth-changed"));

        // redirect to home (or venues)
        router.push("/venues");
        return;
      }

      // 🔁 Case B: fallback → auto-login
      const loginRes = await apiPost("/auth/login", {
        email,
        password,
      });

      if (!loginRes?.access_token) {
        throw new Error("Registration succeeded but login failed.");
      }

      localStorage.setItem(TOKEN_KEY, loginRes.access_token);

      window.dispatchEvent(new Event("convenio-auth-changed"));

      router.push("/venues");
    } catch (e) {
      setError(e.message || "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 420,
        margin: "60px auto",
        padding: 20,
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ marginBottom: 20 }}>Register</h1>

      {error && (
        <div style={{ color: "crimson", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleRegister}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ccc",
            background: busy ? "#f5f5f5" : "white",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Creating account..." : "Register"}
        </button>
      </form>
    </main>
  );
}