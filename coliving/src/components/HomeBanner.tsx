"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listActiveBanners, type AdminBanner } from "@/lib/api/admin";

const FALLBACK_IMAGE = "/hero-friends.png";
const SLIDE_INTERVAL_MS = 5000;
const MAX_TOTAL_SLIDES = 5;
const MAX_REGISTERED_BANNERS = MAX_TOTAL_SLIDES - 1;

function getCtaLabel(linkUrl: string): string {
  return linkUrl.toLowerCase().includes("coupon")
    ? "쿠폰 확인하러 가기"
    : "자세히 보기";
}

const ctaStyle = {
  position: "absolute",
  top: 24,
  right: 28,
  zIndex: 4,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "0 18px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.94)",
  color: "#1f1f1f",
  fontSize: 14,
  fontWeight: 700,
  boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
  pointerEvents: "auto",
  textDecoration: "none",
} as const;

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
          .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
          .slice(0, MAX_REGISTERED_BANNERS);
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
    const fallback = {
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
    } satisfies AdminBanner;

    return [fallback, ...banners].slice(0, MAX_TOTAL_SLIDES);
  }, [banners]);

  useEffect(() => {
    if (activeIndex < slides.length) return;
    setActiveIndex(0);
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const activeBanner = slides[activeIndex] ?? slides[0];
  const activeLink = activeBanner?.linkUrl?.trim() || null;

  return (
    <div
      aria-label="메인 배너"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#f7f2ec",
        pointerEvents: "none",
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

      {activeLink && activeLink.startsWith("/") && !activeLink.startsWith("//") && (
        <Link href={activeLink} style={ctaStyle}>
          {getCtaLabel(activeLink)}
        </Link>
      )}

      {activeLink && (!activeLink.startsWith("/") || activeLink.startsWith("//")) && (
        <a
          href={activeLink}
          target="_blank"
          rel="noopener noreferrer"
          style={ctaStyle}
        >
          {getCtaLabel(activeLink)}
        </a>
      )}

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
            pointerEvents: "auto",
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
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
