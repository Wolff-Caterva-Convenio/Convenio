"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

export default function VenueGallery({
  title,
  apiBase,
  coverImageUrl,
  legacyImageUrl,
  images = [],
}) {
  const normalizedImages = useMemo(() => {
    const result = [];
    const seen = new Set();

    if (coverImageUrl && !seen.has(coverImageUrl)) {
      result.push({
        id: `cover-${coverImageUrl}`,
        image_url: coverImageUrl,
        is_cover: true,
      });
      seen.add(coverImageUrl);
    }

    for (const img of images || []) {
      if (img?.image_url && !seen.has(img.image_url)) {
        result.push({
          id: img.id || `img-${img.image_url}`,
          image_url: img.image_url,
          is_cover: Boolean(img.is_cover),
        });
        seen.add(img.image_url);
      }
    }

    if (legacyImageUrl && !seen.has(legacyImageUrl)) {
      result.push({
        id: `legacy-${legacyImageUrl}`,
        image_url: legacyImageUrl,
        is_cover: false,
      });
      seen.add(legacyImageUrl);
    }

    return result;
  }, [coverImageUrl, legacyImageUrl, images]);

  const [activeImagePath, setActiveImagePath] = useState(null);

  useEffect(() => {
    const initial =
      normalizedImages[0]?.image_url || coverImageUrl || legacyImageUrl || null;
    setActiveImagePath(initial);
  }, [normalizedImages, coverImageUrl, legacyImageUrl]);

  const activeIndex = normalizedImages.findIndex(
    (img) => img.image_url === activeImagePath
  );

  const activeImageUrl = activeImagePath
    ? `${apiBase}${activeImagePath}`
    : null;

  function showPrevImage() {
    if (!normalizedImages.length) return;

    const currentIndex = activeIndex >= 0 ? activeIndex : 0;
    const prevIndex =
      currentIndex === 0 ? normalizedImages.length - 1 : currentIndex - 1;

    setActiveImagePath(normalizedImages[prevIndex].image_url);
  }

  function showNextImage() {
    if (!normalizedImages.length) return;

    const currentIndex = activeIndex >= 0 ? activeIndex : 0;
    const nextIndex =
      currentIndex === normalizedImages.length - 1 ? 0 : currentIndex + 1;

    setActiveImagePath(normalizedImages[nextIndex].image_url);
  }

  if (!normalizedImages.length) {
    return (
      <div
        style={{
          width: "100%",
          height: 360,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #e5e5e5 0%, #f5f5f5 100%)",
          color: "#666",
          fontSize: 14,
        }}
      >
        Image coming soon
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            height: 360,
            overflow: "hidden",
            background: "#f3f3f3",
          }}
        >
          {activeImageUrl ? (
            <Image
              src={activeImageUrl}
              alt={title || "Venue image"}
              fill
              unoptimized
              style={{ objectFit: "cover" }}
            />
          ) : null}
        </div>

        {normalizedImages.length > 1 ? (
          <>
            <button
              type="button"
              onClick={showPrevImage}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                border: "1px solid #ccc",
                background: "rgba(255,255,255,0.92)",
                borderRadius: 999,
                width: 40,
                height: 40,
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              ‹
            </button>

            <button
              type="button"
              onClick={showNextImage}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                border: "1px solid #ccc",
                background: "rgba(255,255,255,0.92)",
                borderRadius: 999,
                width: 40,
                height: 40,
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        {normalizedImages.map((img) => {
          const imgUrl = img?.image_url ? `${apiBase}${img.image_url}` : null;
          const isActive = img.image_url === activeImagePath;

          return (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveImagePath(img.image_url)}
              style={{
                border: isActive ? "2px solid black" : "1px solid #eee",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 140,
                  background: "#f3f3f3",
                }}
              >
                {imgUrl ? (
                  <Image
                    src={imgUrl}
                    alt={title || "Venue image"}
                    fill
                    unoptimized
                    style={{ objectFit: "cover" }}
                  />
                ) : null}
              </div>

              <div style={{ padding: 10, fontSize: 13, color: "#555" }}>
                {img.is_cover ? "Cover image" : "Venue image"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}