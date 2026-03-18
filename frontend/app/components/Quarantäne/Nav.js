"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function hasAuthToken() {
  // Support multiple possible token keys (so we don't break existing login code)
  const keys = ["token", "access_token", "auth_token", "jwt"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && v.trim().length > 0) return true;
  }
  return false;
}

function clearAuthToken() {
  const keys = ["token", "access_token", "auth_token", "jwt"];
  for (const k of keys) localStorage.removeItem(k);
}

export default function Nav() {
  const [loggedIn, setLoggedIn] = useState(false);
  const linkStyle = { marginRight: 12 };

  useEffect(() => {
    setLoggedIn(hasAuthToken());

    // Keep it updated if token changes in another tab
    function onStorage() {
      setLoggedIn(hasAuthToken());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function logout() {
    clearAuthToken();
    window.location.href = "/";
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <Link href="/" style={linkStyle}>Home</Link>
      <Link href="/venues" style={linkStyle}>Venues</Link>

      {loggedIn ? (
        <>
          <Link href="/my-venues" style={linkStyle}>My venues</Link>
          <Link href="/my-bookings" style={linkStyle}>My bookings</Link>
          <Link href="/threads" style={linkStyle}>Inbox</Link>
          <Link href="/me" style={linkStyle}>My account</Link>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <>
          <Link href="/login" style={linkStyle}>Login</Link>
          <Link href="/register">Register</Link>
        </>
      )}
    </div>
  );
}