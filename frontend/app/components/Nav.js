"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function hasAuthToken() {
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
  const linkStyle = { textDecoration: "none", color: "inherit" };

  useEffect(() => {
    setLoggedIn(hasAuthToken());

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
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <Link href="/" style={linkStyle}>Home</Link>
      <Link href="/venues" style={linkStyle}>Venues</Link>

      {loggedIn ? (
        <>
          <Link href="/my-venues" style={linkStyle}>My Venues</Link>
          <Link href="/my-bookings" style={linkStyle}>My Bookings</Link>
          <Link href="/threads" style={linkStyle}>Messages</Link>
          <Link href="/me" style={linkStyle}>My Account</Link>

          <button
            onClick={logout}
            style={{
              marginLeft: "auto",
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: "white",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <Link href="/login" style={linkStyle}>Login</Link>
          <Link href="/register" style={linkStyle}>Register</Link>
        </>
      )}
    </div>
  );
}