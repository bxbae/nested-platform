"use client";

import { useState } from "react";

// A large thumbnail with a graceful gradient fallback. The image zooms
// softly on hover of its containing card (driven by the .thumb-zoom class).
export function Thumbnail({
  src,
  color,
  height = 200,
  children,
}: {
  src?: string;
  color: string;
  height?: number | string;
  children?: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        height,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${color}26, ${color}66)`,
      }}
    >
      {/* Illustrated fallback — a soft "home" motif shown until/unless a
          photo loads, so the card never reads as empty. */}
      <svg
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <circle cx="70" cy="60" r="80" fill="#ffffff" opacity="0.10" />
        <circle cx="330" cy="190" r="90" fill="#ffffff" opacity="0.08" />
        <g stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2.5" fill="none">
          <path d="M150 170 v-48 l50 -34 l50 34 v48 z" />
          <path d="M175 170 v-30 h20 v30" />
        </g>
      </svg>
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="thumb-img"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity .5s ease, transform .5s cubic-bezier(.2,.8,.3,1)",
          }}
        />
      )}
      {/* subtle top gradient for chip legibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.12) 100%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", height: "100%" }}>{children}</div>
    </div>
  );
}
