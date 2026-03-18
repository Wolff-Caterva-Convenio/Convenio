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

    const galleryImages = Array.isArray(images)
      ? images.filter((img) => img?.image_url)
      : [];

    const explicitCover = galleryImages.find((img) => img.is_cover);
    const otherGalleryImages = galleryImages.filter(
      (img) => img.image_url !== explicitCover?.image_url
    );

    if (explicitCover?.image_url && !seen.has(explicitCover.image_url)) {
      result.push({
        id: explicitCover.id || `img-${explicitCover.image_url}`,
        image_url: explicitCover.image_url,
        is_cover: true,
      });
      seen.add(explicitCover.image_url);
    }

    for (const img of otherGalleryImages) {
      if (!seen.has(img.image_url)) {
        result.push({
          id: img.id || `img-${img.image_url}`,
          image_url: img.image_url,
          is_cover: Boolean(img.is_cover),
        });
        seen.add(img.image_url);
      }
    }

    const hasRealGalleryImages = result.length > 0;

    if (
      !hasRealGalleryImages &&
      coverImageUrl &&
      !seen.has(coverImageUrl) &&
      coverImageUrl !== legacyImageUrl
    ) {
      result.push({
        id: `cover-${coverImageUrl}`,
        image_url: coverImageUrl,
        is_cover: true,
      });
      seen.add(coverImageUrl);
    }

    if (!hasRealGalleryImages && legacyImageUrl && !seen.has(legacyImageUrl)) {
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
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    const initial = normalizedImages[0]?.image_url || null;
    setActiveImagePath(initial);
  }, [normalizedImages]);

  const activeIndex = normalizedImages.findIndex(
    (img) => img.image_url === activeImagePath
  );

  const activeImageUrl = activeImagePath ? `${apiBase}${activeImagePath}` : null;

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

  useEffect(() => {
    function handleKey(e) {
      if (!lightboxOpen) return;

      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") showPrevImage();
      if (e.key === "ArrowRight") showNextImage();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxOpen, activeIndex, normalizedImages]);

  if (!normalizedImages.length) {
    return (
      <div
        style={{
          width: "100%",
          height: 360,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#eee",
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
            cursor: "zoom-in",
          }}
          onClick={() => setLightboxOpen(true)}
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
              onClick={showPrevImage}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "1px solid #ccc",
                background: "white",
                cursor: "pointer",
              }}
            >
              ‹
            </button>

            <button
              onClick={showNextImage}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "1px solid #ccc",
                background: "white",
                cursor: "pointer",
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
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        {normalizedImages.map((img) => {
          const imgUrl = `${apiBase}${img.image_url}`;
          const active = img.image_url === activeImagePath;

          return (
            <button
              key={img.id}
              onClick={() => setActiveImagePath(img.image_url)}
              style={{
                border: active ? "2px solid black" : "1px solid #ddd",
                borderRadius: 10,
                overflow: "hidden",
                padding: 0,
                background: "white",
                cursor: "pointer",
              }}
            >
              <div style={{ position: "relative", width: "100%", height: 120 }}>
                <Image
                  src={imgUrl}
                  alt={title || "Venue image"}
                  fill
                  unoptimized
                  style={{ objectFit: "cover" }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {lightboxOpen && activeImageUrl ? (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "90%",
              height: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={activeImageUrl}
              alt={title || "Venue image"}
              fill
              unoptimized
              style={{ objectFit: "contain" }}
            />

            <button
              onClick={() => setLightboxOpen(false)}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                fontSize: 28,
                color: "white",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              ×
            </button>

            {normalizedImages.length > 1 ? (
              <>
                <button
                  onClick={showPrevImage}
                  style={{
                    position: "absolute",
                    left: 20,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 40,
                    color: "white",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ‹
                </button>

                <button
                  onClick={showNextImage}
                  style={{
                    position: "absolute",
                    right: 20,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 40,
                    color: "white",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ›
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}