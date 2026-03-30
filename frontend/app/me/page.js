"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";

export default function MePage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    email: "",
    name: "",
    company_name: "",
  });

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  useEffect(() => {
    async function loadUser() {
      try {
        const data = await apiFetch("/me");
        setUser(data);
        setForm({
          email: data.email || "",
          name: data.name || "",
          company_name: data.company_name || "",
        });
      } catch {
        localStorage.removeItem("access_token");
        router.push("/login?next=/me");
      }
    }

    loadUser();
  }, [router]);

  async function handleSave() {
    setBusy(true);

    try {
      const updated = await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(form),
      });

      setUser(updated);
      setEditing(false);
      alert("Profile updated.");
    } catch (e) {
      alert(e.message || "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    localStorage.removeItem("access_token");
    window.dispatchEvent(new Event("convenio-auth-changed"));
    router.push("/");
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:9000/auth/me/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: formData,
      });

    // ✅ THIS IS THE FIX
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    const data = await res.json();
    setUser(data);
  } catch (e) {
    alert("Upload failed: " + e.message);
  }
}

  async function handlePasswordReset() {
    if (!user?.email) return;

    try {
      const res = await apiFetch(`/auth/forgot-password?email=${user.email}`, {
        method: "POST",
      });

      setResetMsg(res.message);
    } catch (e) {
      setResetMsg("Failed to send reset email.");
    }
  }

  async function handleDeleteAccount() {
    const confirmed = confirm(
      "Are you sure you want to permanently delete your account?"
    );

    if (!confirmed) return;

    setBusy(true);

    try {
      await apiFetch("/auth/me", { method: "DELETE" });

      localStorage.removeItem("access_token");
      window.dispatchEvent(new Event("convenio-auth-changed"));

      alert("Account deleted.");
      router.push("/");
    } catch (e) {
      alert(e.message || "Deletion failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <main style={styles.container}>
        <p>Loading...</p>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <h1 style={styles.title}>My Account</h1>

      {/* PROFILE */}
      <div style={styles.card}>
        <div style={styles.avatar}>
          {user.avatar_url ? (
            <img
              src={`http://127.0.0.1:9000${user.avatar_url}`}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            (form.email || "?").charAt(0).toUpperCase()
          )}
        </div>

        {editing && (
          <input
            type="file"
            onChange={handleUpload}
            style={{ marginTop: 10 }}
          />
        )}

        <div style={{ flex: 1 }}>
          <p style={styles.label}>Email</p>
          {editing ? (
            <input
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              style={styles.input}
            />
          ) : (
            <p style={styles.value}>{user.email}</p>
          )}

          <p style={styles.label}>Name</p>
          {editing ? (
            <input
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              style={styles.input}
            />
          ) : (
            <p style={styles.value}>{user.name || "—"}</p>
          )}

          <p style={styles.label}>Company</p>
          {editing ? (
            <input
              value={form.company_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  company_name: e.target.value,
                })
              }
              style={styles.input}
            />
          ) : (
            <p style={styles.value}>
              {user.company_name || "—"}
            </p>
          )}
        </div>
      </div>

      {/* EDIT BUTTONS */}
      <div style={{ marginBottom: 30 }}>
        {editing ? (
          <>
            <button onClick={handleSave} style={styles.primaryBtn}>
              {busy ? "Saving..." : "Save"}
            </button>

            <button
              onClick={() => setEditing(false)}
              style={styles.secondaryBtn}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            style={styles.primaryBtn}
          >
            Edit Profile
          </button>
        )}
      </div>

      {/* NAV */}
      <div style={styles.section}>
        <h2>Your Activity</h2>

        <div style={styles.grid}>
          <button onClick={() => router.push("/my-bookings")} style={styles.box}>
            My Bookings
          </button>

          <button onClick={() => router.push("/my-venues")} style={styles.box}>
            My Venues
          </button>

          <button onClick={() => router.push("/threads")} style={styles.box}>
            Messages
          </button>
        </div>
      </div>

      {/* ACCOUNT */}
      <div style={styles.section}>
        <h2>Account</h2>

        <button onClick={handlePasswordReset} style={styles.secondaryBtn}>   
          Reset Password
        </button>

        {resetMsg && <p>{resetMsg}</p>}

        <div style={{ marginTop: 10 }}>
          <button onClick={handleLogout} style={styles.secondaryBtn}>
            Log out
          </button>
        </div>
      </div>

      {/* DELETE */}
      <div style={styles.dangerZone}>
        <h2 style={{ color: "crimson" }}>Danger Zone</h2>

        <button
          onClick={handleDeleteAccount}
          disabled={busy}
          style={styles.deleteBtn}
        >
          {busy ? "Deleting..." : "Delete Account"}
        </button>
      </div>
    </main>
  );
}

const styles = {
  container: { maxWidth: 900, margin: "40px auto", padding: "0 20px" },
  title: { marginBottom: 30 },

  card: {
    display: "flex",
    gap: 20,
    padding: 20,
    border: "1px solid #eee",
    borderRadius: 12,
    marginBottom: 30,
    alignItems: "center",
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "#111",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },

  label: { fontSize: 12, color: "#777" },
  value: { marginBottom: 10 },

  input: {
    width: "100%",
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
  },

  primaryBtn: {
    padding: 12,
    borderRadius: 8,
    background: "#111",
    color: "white",
    border: "none",
    marginRight: 10,
  },

  secondaryBtn: {
    padding: 12,
    borderRadius: 8,
    border: "1px solid #ccc",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },

  box: {
    padding: 16,
    borderRadius: 10,
    border: "1px solid #ddd",
  },

  section: { marginBottom: 40 },

  dangerZone: { borderTop: "1px solid #eee", paddingTop: 30 },

  deleteBtn: {
    padding: 12,
    borderRadius: 8,
    background: "crimson",
    color: "white",
    border: "none",
  },
};