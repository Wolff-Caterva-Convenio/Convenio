"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

function getVenueId(v) {
  return v?.id || v?.venue_id || null;
}

export default function HostVenuePage() {
  const params = useParams();
  const router = useRouter();
  const venue_id = params?.venue_id;

  const API_BASE = useMemo(
    () => process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:9000",
    []
  );

  const [venue, setVenue] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [capacity, setCapacity] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const [category, setCategory] = useState("");
  const [type, setType] = useState("");

  const [priceEur, setPriceEur] = useState("");
  const [minNights, setMinNights] = useState("");
  const [rules, setRules] = useState("");

  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [settingCoverImageId, setSettingCoverImageId] = useState(null);
  const [deletingLegacyImage, setDeletingLegacyImage] = useState(false);

  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function getToken() {
    const token = localStorage.getItem("access_token");
    if (!token) throw new Error("Login required.");
    return token;
  }

  async function loadVenue() {
    setError("");
    setSuccess("");
    setVenue(null);

    if (!venue_id) return;

    const token = getToken();

    const res = await fetch(`${API_BASE}/venues/mine`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const venues = await res.json();

    const found = Array.isArray(venues)
      ? venues.find((v) => String(getVenueId(v)) === String(venue_id))
      : null;

    if (!found) {
      throw new Error("Venue not found in your account.");
    }

    setVenue(found);
    setTitle(found.title || "");
    setDescription(found.description || "");
    setCity(found.city || "");
    setCapacity(String(found.capacity ?? ""));
    setCategory(found.venue_category || "");
    setType(found.venue_type || "");
    setPriceEur(((found.payout_net_per_night ?? 0) / 100).toFixed(2));
    setMinNights(String(found.minimum_nights ?? 1));
    setRules(found.rules_and_restrictions || "");
    setSelectedImages([]);
  }

  useEffect(() => {
    loadVenue().catch((e) => setError(e?.message || String(e)));
  }, [venue_id, API_BASE]);

  async function saveDetails() {
    setError("");
    setSuccess("");
    setSavingDetails(true);

    try {
      const token = getToken();
      const cap = Number(capacity);
      const payoutCents = Math.round(Number(priceEur || 0) * 100);
      const minimumNights = Number(minNights || 1);

      if (!title.trim()) throw new Error("Title is required.");
      if (!description.trim()) throw new Error("Description is required.");
      if (!city.trim()) throw new Error("City is required.");
      if (!Number.isInteger(cap) || cap < 1) {
        throw new Error("Capacity must be a whole number of at least 1.");
      }
      if (!Number.isInteger(payoutCents) || payoutCents < 0) {
        throw new Error("Host payout per night must be a valid amount.");
      }
      if (!Number.isInteger(minimumNights) || minimumNights < 1) {
        throw new Error("Minimum nights must be at least 1.");
      }

      const res = await fetch(`${API_BASE}/venues/${venue_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          city: city.trim(),
          capacity: cap,
          venue_category: category || null,
          venue_type: type || null,
          payout_net_per_night: payoutCents,
          minimum_nights: minimumNights,
          rules_and_restrictions: rules.trim() || null,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      setSuccess("Basic details saved.");
      await loadVenue();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSavingDetails(false);
    }
  }

  async function uploadImages() {
    setError("");
    setSuccess("");

    try {
      const token = getToken();

      if (!selectedImages.length) {
        throw new Error("Please choose at least one image first.");
      }

      setUploadingImages(true);

      for (const file of selectedImages) {
        const formData = new FormData();
        formData.append("image", file);

        const res = await fetch(`${API_BASE}/venues/${venue_id}/images`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (!res.ok) throw new Error(await res.text());
      }

      setSelectedImages([]);
      setSuccess("Gallery image(s) uploaded.");
      await loadVenue();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setUploadingImages(false);
    }
  }

  async function deleteImage(imageId) {
    setError("");
    setSuccess("");

    try {
      const token = getToken();
      setDeletingImageId(imageId);

      const res = await fetch(
        `${API_BASE}/venues/${venue_id}/images/${imageId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) throw new Error(await res.text());

      setSuccess("Gallery image deleted.");
      await loadVenue();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setDeletingImageId(null);
    }
  }

  async function setCoverImage(imageId) {
    setError("");
    setSuccess("");

    try {
      const token = getToken();
      setSettingCoverImageId(imageId);

      const res = await fetch(
        `${API_BASE}/venues/${venue_id}/images/${imageId}/set-cover`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) throw new Error(await res.text());

      setSuccess("Cover image updated.");
      await loadVenue();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSettingCoverImageId(null);
    }
  }

  async function deleteLegacyImage() {
    const ok = window.confirm(
      "Delete the old legacy title image?\n\nThis removes the old fallback image that can remain visible even when all gallery images are deleted."
    );
    if (!ok) return;

    setError("");
    setSuccess("");
    setDeletingLegacyImage(true);

    try {
      const token = getToken();

      const res = await fetch(`${API_BASE}/venues/${venue_id}/legacy-image`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error(await res.text());

      setSuccess("Legacy fallback image deleted.");
      await loadVenue();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setDeletingLegacyImage(false);
    }
  }

  async function publishVenue() {
    setError("");
    setSuccess("");
    setPublishing(true);

    try {
      const token = getToken();

      const res = await fetch(`${API_BASE}/venues/${venue_id}/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(await res.text());

      setSuccess("Venue published.");
      await loadVenue();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setPublishing(false);
    }
  }
  async function unpublishVenue() {
    setError("");
    setSuccess("");
    setUnpublishing(true);

    try {
      const token = getToken();

      const res = await fetch(`${API_BASE}/venues/${venue_id}/unpublish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(await res.text());

      setSuccess("Venue unpublished and moved back to draft.");
      await loadVenue();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setUnpublishing(false);
    }
  }

  async function deleteVenue() {
    const ok = window.confirm(
      "Delete this venue?\n\nThis only works if the venue has no bookings."
    );
    if (!ok) return;

    setError("");
    setSuccess("");
    setDeleting(true);

    try {
      const token = getToken();

      const res = await fetch(`${API_BASE}/venues/${venue_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(await res.text());

      router.push("/my-venues");
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setDeleting(false);
    }
  }

  if (!venue_id) {
    return (
      <main
        style={{
          fontFamily: "system-ui",
          padding: 24,
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <div>Loading route…</div>
      </main>
    );
  }

  if (error && !venue) {
    return (
      <main
        style={{
          fontFamily: "system-ui",
          padding: 24,
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <h2>Error</h2>
        <div style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{error}</div>
        <div style={{ marginTop: 12 }}>
          <a href="/my-venues">← Back to My venues</a>
        </div>
      </main>
    );
  }

  if (!venue) {
    return (
      <main
        style={{
          fontFamily: "system-ui",
          padding: 24,
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <div>Loading venue…</div>
      </main>
    );
  }

  const vid = getVenueId(venue);
  const availableTypes = category ? CATEGORY_TYPES[category] : [];
  const galleryImages = Array.isArray(venue?.images) ? venue.images : [];
  const currentDisplayImagePath = venue?.cover_image_url || venue?.image_url || null;
  const currentDisplayImageUrl = currentDisplayImagePath
    ? `${API_BASE}${currentDisplayImagePath}`
    : null;
  const legacyImageUrl = venue?.image_url ? `${API_BASE}${venue.image_url}` : null;

  return (
    <main
      style={{
        fontFamily: "system-ui",
        padding: 24,
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1>Manage venue</h1>

      <div style={{ marginBottom: 16 }}>
        <a href="/my-venues">← Back to My venues</a>
      </div>

      {error ? (
        <div
          style={{ color: "crimson", marginBottom: 12, whiteSpace: "pre-wrap" }}
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          style={{ color: "green", marginBottom: 12, whiteSpace: "pre-wrap" }}
        >
          {success}
        </div>
      ) : null}

      <div
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        {currentDisplayImageUrl ? (
          <img
            src={currentDisplayImageUrl}
            alt={venue.title}
            style={{
              width: "100%",
              maxHeight: 280,
              objectFit: "cover",
              borderRadius: 10,
              marginBottom: 14,
            }}
          />
        ) : null}

        <h2 style={{ marginTop: 0 }}>{venue.title}</h2>
        <div>{venue.description}</div>
        <div style={{ marginTop: 6 }}>{venue.city}</div>
        <div>Capacity: {venue.capacity}</div>
        <div style={{ marginTop: 10 }}>
          Current price/night:{" "}
          <b>€{((venue.payout_net_per_night ?? 0) / 100).toFixed(2)}</b>
        </div>
        <div style={{ marginTop: 6 }}>
          Current minimum nights: <b>{venue.minimum_nights ?? 1}</b>
        </div>
        <div style={{ marginTop: 6 }}>
          Category: <b>{venue.venue_category || "—"}</b>
        </div>
        <div style={{ marginTop: 6 }}>
          Type: <b>{venue.venue_type || "—"}</b>
        </div>
        <div style={{ marginTop: 6 }}>
          Status: <b>{venue.status || "draft"}</b>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Edit basic details</h3>

        <div style={{ display: "grid", gap: 12 }}>
          <label>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4,
              }}
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4,
              }}
            />
          </label>

          <label>
            City
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4,
              }}
            />
          </label>

          <label>
            Capacity
            <input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              inputMode="numeric"
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4,
              }}
            />
          </label>

          <label>
            Category
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setType("");
              }}
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4,
              }}
            >
              <option value="">Select category</option>
              {Object.keys(CATEGORY_TYPES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label>
            Venue type
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              disabled={!category}
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4,
              }}
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
          </label>

          <label>
            Host payout per night (€)
            <input
              value={priceEur}
              onChange={(e) => setPriceEur(e.target.value)}
              inputMode="decimal"
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4,
              }}
            />
          </label>

          <label>
            Minimum nights
            <input
              value={minNights}
              onChange={(e) => setMinNights(e.target.value)}
              inputMode="numeric"
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4,
              }}
            />
          </label>

          <label>
            Rules & restrictions
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={6}
              placeholder="Enter your venue rules here..."
              style={{
                display: "block",
                width: "100%",
                padding: 8,
                boxSizing: "border-box",
                marginTop: 4,
              }}
            />
          </label>

          <div>
            <button
              onClick={saveDetails}
              disabled={savingDetails}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
              }}
            >
              {savingDetails ? "Saving..." : "Save details"}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Venue gallery</h3>

        <div style={{ marginBottom: 12, opacity: 0.8 }}>
          Upload one or more JPG, PNG, or WEBP images (max 5 MB each).
        </div>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setSelectedImages(Array.from(e.target.files || []))}
          style={{ marginBottom: 12 }}
        />

        <div style={{ marginBottom: 12, fontSize: 14, opacity: 0.8 }}>
          {selectedImages.length > 0
            ? `${selectedImages.length} file(s) selected`
            : "No new files selected"}
        </div>

        <div style={{ marginBottom: 16 }}>
          <button
            onClick={uploadImages}
            disabled={uploadingImages || selectedImages.length === 0}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "white",
            }}
          >
            {uploadingImages ? "Uploading..." : "Upload selected images"}
          </button>
        </div>

        {legacyImageUrl ? (
          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Legacy fallback image
            </div>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
              This is the old single-image field. It can still appear publicly
              even after gallery images are deleted. Delete it if you want the
              old stuck title image to disappear completely.
            </div>

            <img
              src={legacyImageUrl}
              alt="Legacy venue"
              style={{
                width: "100%",
                maxWidth: 320,
                height: 180,
                objectFit: "cover",
                borderRadius: 8,
                marginBottom: 10,
                display: "block",
              }}
            />

            <button
              onClick={deleteLegacyImage}
              disabled={deletingLegacyImage}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
              }}
            >
              {deletingLegacyImage ? "Deleting..." : "Delete legacy image"}
            </button>
          </div>
        ) : null}

        {galleryImages.length === 0 ? (
          <div style={{ opacity: 0.75 }}>No gallery images uploaded yet.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {galleryImages.map((img) => {
              const imgUrl = img?.image_url ? `${API_BASE}${img.image_url}` : null;

              return (
                <div
                  key={img.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    padding: 10,
                    background: "white",
                  }}
                >
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt="Venue gallery"
                      style={{
                        width: "100%",
                        height: 120,
                        objectFit: "cover",
                        borderRadius: 8,
                        marginBottom: 10,
                      }}
                    />
                  ) : null}

                  <div style={{ fontSize: 13, marginBottom: 8 }}>
                    {img.is_cover ? <b>Cover image</b> : "Gallery image"}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setCoverImage(img.id)}
                      disabled={settingCoverImageId === img.id || img.is_cover}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                      }}
                    >
                      {img.is_cover
                        ? "Current cover"
                        : settingCoverImageId === img.id
                        ? "Saving..."
                        : "Set cover"}
                    </button>

                    <button
                      onClick={() => deleteImage(img.id)}
                      disabled={deletingImageId === img.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                      }}
                    >
                      {deletingImageId === img.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Publishing status</h3>

        <div style={{ marginBottom: 12, color: "#555" }}>
          Current status: <b>{venue.status || "draft"}</b>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {venue.status === "draft" ? (
            <button
              onClick={publishVenue}
              disabled={publishing}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
              }}
            >
              {publishing ? "Publishing..." : "Publish venue"}
            </button>
          ) : (
            <button
              onClick={unpublishVenue}
              disabled={unpublishing}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
              }}
            >
              {unpublishing ? "Unpublishing..." : "Unpublish venue"}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          padding: 16,
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Danger zone</h3>
        <div style={{ marginBottom: 12, color: "#555" }}>
          Delete only works if the venue has no bookings.
        </div>
        <button
          onClick={deleteVenue}
          disabled={deleting}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
          }}
        >
          {deleting ? "Deleting..." : "Delete venue"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href={`/venues/${vid}/availability`}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            textDecoration: "none",
          }}
        >
          Manage availability
        </a>
        <a
          href={`/my-venues/bookings`}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            textDecoration: "none",
          }}
        >
          View all bookings
        </a>
        <a
          href={`/venues/${vid}`}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            textDecoration: "none",
          }}
        >
          View listing
        </a>
      </div>
    </main>
  );
}