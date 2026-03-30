"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "../lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setBusy(true);

    try {
      await apiPost("/auth/register", {
        email,
        password,
      });

      // ✅ Correct behavior: wait for email verification
      setSuccess("Account created! Please check your email to verify your account.");

      // optional: clear inputs
      setEmail("");
      setPassword("");

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

      {success && (
        <div style={{ color: "green", marginBottom: 12 }}>
          {success}
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