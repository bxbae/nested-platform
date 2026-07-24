"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Star, MapPin, Heart } from "lucide-react";
import type { House } from "@/lib/types";
import { ROOM_TYPE_LABELS, GENDER_LABELS } from "@/lib/types";
import { won } from "@/lib/format";
import { Thumbnail } from "@/components/Thumbnail";
import { useFavorite } from "@/lib/api/useFavorites";
import { regionLabel } from "@/lib/seoul";

const MotionLink = motion.create(Link);

export function PropertyCard({
  house,
  onHover,
  active,
}: {
  house: House;
  onHover?: (id: string | null) => void;
  active?: boolean;
}) {
  // 찜 상태는 서버가 진실이다. 예전에는 Zustand 로컬 상태만 바꿔서, 하트는
  // 채워지는데 새로고침하면 사라지고 상세 화면과도 어긋났다.
  const { saved, toggle } = useFavorite(house.id);

  const badges: string[] = [];
  if (house.petsAllowed) badges.push("🐾 반려동물");
  if (house.parking) badges.push("🅿 주차");
  if (house.genderPolicy !== "any") badges.push(GENDER_LABELS[house.genderPolicy]);

  return (
    <MotionLink
      href={`/homes/${house.id}`}
      className="card hover-card"
      onMouseEnter={() => onHover?.(house.id)}
      onMouseLeave={() => onHover?.(null)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.3, 1] }}
      whileHover={{ y: -4 }}
      style={{
        overflow: "hidden",
        outline: active ? "2px solid var(--primary)" : "none",
        outlineOffset: -1,
      }}
    >
      <Thumbnail src={house.photo} color={house.color} height={190}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: 12,
            height: "100%",
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span
              className="chip glass"
              style={{ border: "none", color: "var(--text)", fontWeight: 600 }}
            >
              {ROOM_TYPE_LABELS[house.roomType]}
            </span>
            {house.isMine && (
              <span
                className="chip"
                style={{
                  border: "none",
                  fontWeight: 700,
                  fontSize: 12,
                  background: "var(--primary)",
                  color: "#fff",
                }}
              >
                내 숙소
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label={saved ? "찜 해제" : "찜하기"}
            aria-pressed={saved}
            onClick={async (e) => {
              // 카드 전체가 링크라 기본 이동을 막아야 한다.
              e.preventDefault();
              e.stopPropagation();
              const res = await toggle();
              if (!res.ok) {
                alert(
                  res.reason === "auth"
                    ? "로그인이 필요합니다."
                    : "잠시 후 다시 시도해주세요.",
                );
              }
            }}
            className="press"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              background: "rgba(255,255,255,0.9)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <Heart
              size={17}
              stroke={saved ? "var(--primary)" : "var(--text-2)"}
              fill={saved ? "var(--primary)" : "none"}
            />
          </button>
        </div>
      </Thumbnail>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <strong style={{ fontSize: 15.5 }}>{house.name.trim()}</strong>
          <span style={{ fontSize: 13, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }}>
            <Star size={13} fill="var(--primary)" stroke="var(--primary)" /> {house.rating}
          </span>
        </div>
        <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
          <MapPin size={13} /> {regionLabel(house.region)} · 리뷰 {house.reviews}개
          {house.bedrooms ? ` · 방 ${house.bedrooms}개` : ""}
          {house.capacity ? ` · 최대 ${house.capacity}명` : ""}
        </div>
        {badges.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {badges.map((b) => (
              <span key={b} className="chip" style={{ fontSize: 11, padding: "3px 9px" }}>
                {b}
              </span>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, fontSize: 15, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>
            <strong>{won(house.monthlyRent)}</strong>
            <span style={{ color: "var(--text-2)", fontSize: 13 }}> / 월</span>
          </span>
          {/* 오늘 기준 누가 살고 있는 방 — 목록에서 빼지 않고 표시만 한다.
              나중 날짜로는 입주할 수 있기 때문이다. */}
          {house.occupied && (
            <span
              className="chip"
              title={
                house.availableAgainFrom
                  ? `${new Date(house.availableAgainFrom).toLocaleDateString("ko-KR")}부터 입주 가능`
                  : "현재 입주 중"
              }
              style={{
                fontSize: 11, padding: "3px 9px", border: "none",
                background: "var(--text-2)", color: "#fff",
              }}
            >
              입주 중
            </span>
          )}
        </div>
      </div>
    </MotionLink>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="card" style={{ overflow: "hidden" }} aria-hidden="true">
      <div className="sk" style={{ height: 190 }} />
      <div style={{ padding: 16 }}>
        <div className="sk" style={{ height: 16, width: "70%", borderRadius: 6 }} />
        <div className="sk" style={{ height: 12, width: "50%", marginTop: 10, borderRadius: 6 }} />
        <div className="sk" style={{ height: 20, width: "40%", marginTop: 16, borderRadius: 6 }} />
      </div>
    </div>
  );
}
