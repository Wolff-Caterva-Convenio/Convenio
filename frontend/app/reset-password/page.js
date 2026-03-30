"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiPost } from "../lib/api";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();

  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!password) {
      setError("Please enter a new password.");
      return;
    }

    try {
      const res = await apiPost(
        `/auth/reset-password?token=${token}&new_password=${password}`
      );

      setMsg(res.message);

      // ✅ redirect after short delay
      setTimeout(() => {
        router.push("/login");
      }, 1500);

    } catch (e) {
      setError(e.message || "Reset failed.");
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "60px auto" }}>
      <h1>Reset Password</h1>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {msg && <p style={{ color: "green" }}>{msg}</p>}

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 12 }}
        />

        <button type="submit">Reset Password</button>
      </form>
    </main>
  );
}