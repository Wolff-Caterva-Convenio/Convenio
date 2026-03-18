"use client";

import { useEffect, useState } from "react";

export default function MeTest() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("http://localhost:8000/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>/me test</h1>
      {err && <pre>{err}</pre>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      <p><a href="/">← Home</a></p>
    </main>
  );
}
