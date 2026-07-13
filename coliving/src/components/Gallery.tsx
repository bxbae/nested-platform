"use client";

import { useState, useEffect } from "react";

// Airbnb-style gallery: one large image + a 2×2 grid of thumbnails, with a
// "사진 모두 보기" button that opens a keyboard-navigable lightbox.
export function Gallery({
  images,
  color,
  alt,
}: {
  images: string[];
  color: string;
  alt: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const pics = images.slice(0, 5);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length]);

  // A listing created without photos would otherwise render an empty, clickable
  // box. Show a tinted placeholder instead of nothing.
  if (pics.length === 0) {
    return (
      <div
        className="gallery-main"
        style={{
          background: `linear-gradient(135deg, ${color}22, ${color}0a)`,
          display: "grid",
          placeItems: "center",
          color: "var(--text-2)",
          fontSize: 14,
          minHeight: 280,
          borderRadius: "var(--r-md)",
        }}
      >
        아직 등록된 사진이 없어요
      </div>
    );
  }

  return (
    <>
      <div className="gallery">
        <button
          className="gallery-main press"
          onClick={() => {
            setIndex(0);
            setOpen(true);
          }}
          aria-label="사진 크게 보기"
        >
          <GalleryImg src={pics[0]} color={color} alt={`${alt} 대표 사진`} />
        </button>
        <div className="gallery-thumbs">
          {pics.slice(1, 5).map((src, i) => (
            <button
              key={i}
              className="gallery-thumb press"
              onClick={() => {
                setIndex(i + 1);
                setOpen(true);
              }}
              aria-label={`사진 ${i + 2} 보기`}
            >
              <GalleryImg src={src} color={color} alt={`${alt} 사진 ${i + 2}`} />
            </button>
          ))}
        </div>

        <button
          className="btn btn-ghost press"
          onClick={() => setOpen(true)}
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            background: "#fff",
            fontSize: 13,
            padding: "8px 14px",
          }}
        >
          ⊞ 사진 모두 보기
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="사진 갤러리"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            flexDirection: "column",
            animation: "fadeIn .2s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              color: "#fff",
            }}
          >
            <span style={{ fontSize: 14 }}>
              {index + 1} / {images.length}
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="닫기"
              style={{ color: "#fff", fontSize: 26, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: "0 16px 24px",
            }}
          >
            <button
              onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
              aria-label="이전 사진"
              className="press"
              style={lightboxNav}
            >
              ‹
            </button>
            <div
              style={{
                flex: 1,
                maxWidth: 1000,
                height: "78vh",
                borderRadius: "var(--r-lg)",
                overflow: "hidden",
                background: `linear-gradient(135deg, ${color}33, ${color}66)`,
              }}
            >
              <GalleryImg src={images[index]} color={color} alt={`${alt} 사진 ${index + 1}`} cover />
            </div>
            <button
              onClick={() => setIndex((i) => (i + 1) % images.length)}
              aria-label="다음 사진"
              className="press"
              style={lightboxNav}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const lightboxNav: React.CSSProperties = {
  color: "#fff",
  fontSize: 40,
  width: 52,
  height: 52,
  borderRadius: 99,
  background: "rgba(255,255,255,0.12)",
  flexShrink: 0,
};

function GalleryImg({
  src,
  color,
  alt,
  cover,
}: {
  src?: string;
  color: string;
  alt: string;
  cover?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: `linear-gradient(135deg, ${color}26, ${color}66)`,
      }}
    >
      {/* home-motif fallback */}
      <svg
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <g stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2.5" fill="none">
          <path d="M150 170 v-48 l50 -34 l50 34 v48 z" />
          <path d="M175 170 v-30 h20 v30" />
        </g>
      </svg>
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: cover ? "contain" : "cover",
          }}
        />
      )}
    </div>
  );
}
