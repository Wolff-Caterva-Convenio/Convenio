"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORY_TYPES = {
  "Art & Culture": [
    "Gallery",
    "Artist Studio",
    "Exhibition Space",
    "Residency Space",
    "Museum / Cultural Space",
    "Theater / Performance Space",
    "Rehearsal Space",
  ],
  "Events & Social": [
    "Event Venue",
    "Party Location",
    "Private Dining Space",
    "Rooftop Venue",
    "Bar / Club",
    "Lounge",
  ],
  "Creative Production": [
    "Photo Studio",
    "Filming Location",
    "Production Studio",
    "Podcast Studio",
    "Content Creation Studio",
    "Green Screen Studio",
    "Recording Studio",
  ],
  "Workshops & Education": [
    "Workshop Space",
    "Classroom",
    "Training Room",
    "Seminar Space",
    "Craft Studio",
    "Maker Space",
  ],
  "Professional / Business": [
    "Meeting Room",
    "Conference Venue",
    "Coworking Space",
    "Presentation Space",
    "Startup Hub",
    "Innovation Lab",
  ],
  "Community Spaces": [
    "Community Center",
    "Clubhouse",
    "Nonprofit Space",
    "Youth Center",
    "Social Club",
  ],
  "Unique Spaces": [
    "Industrial Loft",
    "Warehouse",
    "Historic Building",
    "Castle / Estate",
    "Architectural House",
    "Glass Pavilion",
    "Garden Venue",
    "Outdoor Venue",
  ],
};

export default function CreateVenuePage() {
  const router = useRouter();

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [streetAddress, setStreetAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");

  const [capacity, setCapacity] = useState("");
  const [pricePerNight, setPricePerNight] = useState("");
  const [minimumNights, setMinimumNights] = useState("1");

  const [category, setCategory] = useState("");
  const [type, setType] = useState("");

  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  function getToken() {
    const token = localStorage.getItem("access_token");
    if (!token) throw new Error("Login required.");
    return token;
  }

  async function createVenue(e) {
    e.preventDefault();
    if (creating) return;

    setError("");

    let token;
    try {
      token = getToken();
    } catch (e) {
      setError(e?.message || String(e));
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedCity = city.trim();

    const capacityNum = Number(capacity);
    const priceNum = Number(pricePerNight);
    const minNightsNum = Number(minimumNights);

    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }

    if (!trimmedDescription) {
      setError("Description is required.");
      return;
    }

    if (!trimmedCity) {
      setError("City is required.");
      return;
    }

    if (!Number.isInteger(capacityNum) || capacityNum < 1) {
      setError("Capacity must be a whole number of at least 1.");
      return;
    }

    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Price per night must be a valid number greater than or equal to 0.");
      return;
    }

    if (!Number.isInteger(minNightsNum) || minNightsNum < 1) {
      setError("Minimum booking duration must be a whole number of at least 1.");
      return;
    }

    setCreating(true);

    try {
      const payload = {
        title: trimmedTitle,
        description: trimmedDescription,
        city: trimmedCity,
        capacity: capacityNum,
        payout_net_per_night: Math.round(priceNum * 100),
        minimum_nights: minNightsNum,
        venue_category: category || null,
        venue_type: type || null,
      };

      const res = await fetch(`${API_BASE}/venues`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const venue = await res.json();
      router.push(`/my-venues/${venue.id}`);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  }

  const availableTypes = category ? CATEGORY_TYPES[category] : [];

  return (
    <main
      style={{
        fontFamily: "system-ui",
        padding: 24,
        maxWidth: 700,
        margin: "0 auto",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Link href="/my-venues">← Back to My venues</Link>
      </div>

      <h1>Create new venue</h1>

      {error ? (
        <div style={{ color: "crimson", marginBottom: 12, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      ) : null}

      <form onSubmit={createVenue}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Venue title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={creating}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
            disabled={creating}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
        </div>

        <hr style={{ margin: "24px 0" }} />

        <h2 style={{ marginBottom: 10 }}>Venue category</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Category
          </label>
          <select
            value={category}
            disabled={creating}
            onChange={(e) => {
              setCategory(e.target.value);
              setType("");
            }}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          >
            <option value="">Select category</option>
            {Object.keys(CATEGORY_TYPES).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Venue type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={!category || creating}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          >
            <option value="">
              {category ? "Select type" : "Select category first"}
            </option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <hr style={{ margin: "24px 0" }} />

        <h2 style={{ marginBottom: 10 }}>Location</h2>

        <div style={{ marginBottom: 8, fontSize: 14, color: "#666" }}>
          Only the city is currently connected to the backend. The other
          location fields are still UI-only for now.
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Street address
          </label>
          <input
            value={streetAddress}
            onChange={(e) => setStreetAddress(e.target.value)}
            disabled={creating}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Postal code
          </label>
          <input
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            disabled={creating}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            City
          </label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            disabled={creating}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Country
          </label>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. Austria"
            disabled={creating}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
        </div>

        <hr style={{ margin: "24px 0" }} />

        <h2 style={{ marginBottom: 10 }}>Venue details</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Capacity (maximum number of people)
          </label>
          <input
            type="number"
            min="1"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
            disabled={creating}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Price per night (€ guest price)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={pricePerNight}
            onChange={(e) => setPricePerNight(e.target.value)}
            required
            disabled={creating}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Minimum booking duration (nights)
          </label>
          <input
            type="number"
            min="1"
            value={minimumNights}
            onChange={(e) => setMinimumNights(e.target.value)}
            required
            disabled={creating}
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
        </div>

        <button type="submit" disabled={creating}>
          {creating ? "Creating venue..." : "Create venue"}
        </button>
      </form>
    </main>
  );
}