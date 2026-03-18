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
    return <p>{error}</p>;
  }

  if (!user) {
    return <p>Loading...</p>;
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>My Account</h1>

      <p>
        <strong>Email:</strong> {user.email}
      </p>

      <p>
        <strong>User ID:</strong> {user.id}
      </p>
    </div>
  );
}