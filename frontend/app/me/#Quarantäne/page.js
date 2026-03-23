"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000";

export default function MePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("access_token");

      if (!token) {
        router.push("/login?next=/me");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Session expired");
        }

        const data = await res.json();
        setUser(data);
      } catch (err) {
        localStorage.removeItem("access_token");
        setError(err.message);
      }
    }

    loadUser();
  }, [router]);

  if (error) {
    return (
      <main
        style={{
          maxWidth: 1100,
          margin: "40px auto",
          padding: "0 20px",
          fontFamily: "system-ui",
        }}
      >
        <p>{error}</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        style={{
          maxWidth: 1100,
          margin: "40px auto",
          padding: "0 20px",
          fontFamily: "system-ui",
        }}
      >
        <p>Loading...</p>
      </main>
    );
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
      <h1 style={{ marginTop: 0, marginBottom: 24 }}>My Account</h1>

      <p>
        <strong>Email:</strong> {user.email}
      </p>

      <p>
        <strong>User ID:</strong> {user.id}
      </p>
    </main>
  );
}