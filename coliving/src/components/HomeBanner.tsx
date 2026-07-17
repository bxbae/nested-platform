"use client";

import { useEffect, useState } from "react";
import { listActiveBanners, type AdminBanner } from "@/lib/api/admin";

// Home hero banner (스토리보드 02 메인 배너). Shows the first active banner
// tagged for the top slot ("메인 상단"), falling back to any active banner.
// Renders nothing while loading or when there are none.
export function HomeBanner() {
  const [banner, setBanner] = useState<AdminBanner | null>(null);

  useEffect(() => {
    let alive = true;
    listActiveBanners()
      .then((rows) => {
        if (!alive || rows.length === 0) return;
        const top = rows.find((b) => b.position === "메인 상단") ?? rows[0];
        setBanner(top);
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!banner) return null;

  const inner = (
    <div
      style={{
        borderRadius: "var(--r-md, 16px)",
        background: `linear-gradient(135deg, ${banner.color}, ${banner.color}bb)`,
        padding: "28px 32px",
        display: "flex",
        alignItems: "center",
        minHeight: 96,
      }}
    >
      <strong style={{ color: "#fff", fontSize: 20, letterSpacing: "-0.01em" }}>{banner.title}</strong>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 20px 0" }}>
      {banner.linkUrl ? (
        <a href={banner.linkUrl} style={{ textDecoration: "none", display: "block" }}>
          {inner}
        </a>
      ) : (
        inner
      )}
    </div>
  );
}
