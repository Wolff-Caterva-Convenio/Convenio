"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiPost, TOKEN_KEY } from "../lib/api";

export default function VerifiedPage() {
  const params = useSearchParams();
  const router = useRouter();

  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");

    if (!token) {
      setError("Missing verification token.");
      return;
    }

    async function completeVerification() {
      try {
        const res = await apiPost("/auth/verify-email/complete?token=" + token);

        if (!res?.access_token) {
          throw new Error("Login failed after verification.");
        }

        localStorage.setItem(TOKEN_KEY, res.access_token);

        window.dispatchEvent(new Event("convenio-auth-changed"));

        // ✅ redirect to app
        router.push("/venues");
      } catch (e) {
        setError(e.message || "Verification failed.");
      }
    }

    completeVerification();
  }, []);

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", textAlign: "center" }}>
      <h1>Email Verification</h1>

      {!error && <p>Verifying your account...</p>}

      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}