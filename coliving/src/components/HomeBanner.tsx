"use client";

import { useEffect, useMemo, useState } from "react";
import { listActiveBanners, type AdminBanner } from "@/lib/api/admin";

const FALLBACK_IMAGE = "/hero-friends.png";
const SLIDE_INTERVAL_MS = 5000;

export function HomeBanner() {
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    listActiveBanners()
      .then((rows) => {
        if (!alive) return;
        const heroRows = rows
          .filter((banner) => banner.position === "메인 상단")
          .sort((a, b) => a.order - b.order);
        setBanners(heroRows);
        setActiveIndex(0);
      })
      .catch(() => {
        if (alive) {
          setBanners([]);
          setActiveIndex(0);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const slides = useMemo(() => {
    if (banners.length > 0) return banners;
    return [
      {
        id: "fallback",
        title: "Nested 공유주거",
        color: "#f7f2ec",
        position: "메인 상단",
        linkUrl: null,
        imageUrl: FALLBACK_IMAGE,
        active: true,
        order: 0,
        createdAt: "",
        updatedAt: "",
      } satisfies AdminBanner,
    ];
  }, [banners]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <div
      aria-label="메인 배너"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#f7f2ec",
      }}
    >
      {slides.map((banner, index) => {
        const imageUrl = banner.imageUrl?.trim() || FALLBACK_IMAGE;
        return (
          <div
            key={banner.id}
            role="img"
            aria-label={banner.title}
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url("${imageUrl}")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
              backgroundSize: "cover",
              opacity: index === activeIndex ? 1 : 0,
              transition: "opacity 700ms ease",
              pointerEvents: "none",
            }}
          />
        );
      })}

      {slides.length > 1 && (
        <div
          aria-label="배너 페이지"
          style={{
            position: "absolute",
            right: 28,
            bottom: 24,
            zIndex: 3,
            display: "flex",
            gap: 7,
          }}
        >
          {slides.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              aria-label={`${index + 1}번째 배너 보기`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => setActiveIndex(index)}
              style={{
                width: index === activeIndex ? 24 : 8,
                height: 8,
                borderRadius: 999,
                background:
                  index === activeIndex
                    ? "var(--primary)"
                    : "rgba(255,255,255,0.88)",
                boxShadow: "0 1px 5px rgba(0,0,0,0.2)",
                transition: "width 180ms ease, background 180ms ease",
                pointerEvents: "auto",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
