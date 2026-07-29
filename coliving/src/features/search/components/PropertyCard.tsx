"use client";

import { motion } from "framer-motion";
import { Heart, MapPin, Star } from "lucide-react";

import { Thumbnail } from "@/components/Thumbnail";
import { won } from "@/lib/format";
import { useFavorite } from "@/lib/api/useFavorites";
import { regionLabel } from "@/lib/seoul";
import type { House } from "@/lib/types";
import {
  GENDER_LABELS,
  getAccommodationLabel,
  getPriceUnitLabel,
} from "@/lib/types";

export function PropertyCard({
  house,
  onHover,
  onSelect,
  active,
}: {
  house: House;
  onHover?: (id: string | null) => void;
  onSelect?: (house: House) => void;
  active?: boolean;
}) {
  const { saved, toggle } = useFavorite(house.id);
  const inventory = house.inventory;
  const isClosed = inventory?.fullyBooked ?? false;

  const badges: string[] = [];
  if (house.petsAllowed) badges.push("🐾 반려동물");
  if (house.parking) badges.push("🅿 주차");
  if (house.genderPolicy !== "any") {
    badges.push(GENDER_LABELS[house.genderPolicy]);
  }

  const visibleBadges = badges.slice(0, 2);
  const hiddenBadgeCount = Math.max(0, badges.length - visibleBadges.length);

  const openPreview = () => onSelect?.(house);

  return (
    <motion.article
      className={`card hover-card search-property-card${
        active ? " is-map-active" : ""
      }${isClosed ? " is-closed" : ""}`}
      onMouseEnter={() => onHover?.(house.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={openPreview}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPreview();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${house.name.trim()} 미리보기 열기`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.3, 1] }}
    >
      <Thumbnail
        src={house.photo}
        color={house.color}
        height="var(--search-card-image-height, 190px)"
        imageFilter={
          isClosed ? "grayscale(1) saturate(0) brightness(.72)" : undefined
        }
      >
        <div className="search-property-overlay">
          <div className="search-property-top-badges">
            <span className="chip glass search-property-type-chip">
              {getAccommodationLabel(house)}
            </span>

            {house.isMine && (
              <span className="chip search-property-status-chip is-mine">
                내 숙소
              </span>
            )}

            {inventory &&
              (inventory.fullyBooked || inventory.remainingSpots != null) && (
                <span
                  className={`chip search-property-status-chip${
                    inventory.fullyBooked ? " is-closed" : " is-available"
                  }`}
                >
                  {inventory.blocked
                    ? inventory.scope === "SELECTED_DATES"
                      ? "선택 기간 호스트 차단"
                      : "오늘 호스트 차단"
                    : inventory.fullyBooked
                      ? inventory.scope === "SELECTED_DATES"
                        ? "선택 기간 예약 마감"
                        : "현재 예약 마감"
                      : inventory.scope === "SELECTED_DATES"
                        ? `선택 기간 잔여 ${inventory.remainingSpots}자리`
                        : `오늘 잔여 ${inventory.remainingSpots}자리`}
                </span>
              )}
          </div>

          <button
            type="button"
            aria-label={saved ? "찜 해제" : "찜하기"}
            aria-pressed={saved}
            onClick={async (event) => {
              event.preventDefault();
              event.stopPropagation();

              const result = await toggle();
              if (!result.ok) {
                alert(
                  result.reason === "auth"
                    ? "로그인이 필요합니다."
                    : "잠시 후 다시 시도해주세요.",
                );
              }
            }}
            onKeyDown={(event) => event.stopPropagation()}
            className="press search-property-favorite"
          >
            <Heart
              size={16}
              stroke={saved ? "var(--primary)" : "var(--text-2)"}
              fill={saved ? "var(--primary)" : "none"}
            />
          </button>
        </div>
      </Thumbnail>

      <div className="search-property-body">
        <div className="search-property-heading">
          <strong className="search-property-title">{house.name.trim()}</strong>
          <span className="search-property-rating">
            <Star size={12} fill="var(--primary)" stroke="var(--primary)" />
            {house.rating}
          </span>
        </div>

        <div className="search-property-meta">
          <MapPin size={12} />
          <span>
            {regionLabel(house.region)} · 리뷰 {house.reviews}개
            {house.bedrooms ? ` · 방 ${house.bedrooms}개` : ""}
            {house.capacity ? ` · 최대 ${house.capacity}명` : ""}
          </span>
        </div>

        {visibleBadges.length > 0 && (
          <div className="search-property-feature-row">
            {visibleBadges.map((badge) => (
              <span key={badge} className="chip search-property-feature-chip">
                {badge}
              </span>
            ))}
            {hiddenBadgeCount > 0 && (
              <span className="chip search-property-feature-chip">
                +{hiddenBadgeCount}
              </span>
            )}
          </div>
        )}

        <div className="search-property-price-row">
          <span className="search-property-price">
            <strong>{won(house.monthlyRent)}</strong>
            <span> / 월 · {getPriceUnitLabel(house.rentalUnit)}</span>
          </span>

          {house.occupied &&
            !inventory?.fullyBooked &&
            inventory?.remainingSpots == null && (
              <span
                className="chip search-property-occupied-chip"
                title={
                  house.availableAgainFrom
                    ? `${new Date(house.availableAgainFrom).toLocaleDateString(
                        "ko-KR",
                      )}부터 입주 가능`
                    : "현재 입주 중"
                }
              >
                입주 중
              </span>
            )}
        </div>
      </div>
    </motion.article>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="card search-property-card" aria-hidden="true">
      <div
        className="sk search-property-skeleton-image"
        style={{ height: "var(--search-card-image-height, 190px)" }}
      />
      <div className="search-property-body">
        <div className="sk search-property-skeleton-line is-title" />
        <div className="sk search-property-skeleton-line is-meta" />
        <div className="sk search-property-skeleton-line is-price" />
      </div>
    </div>
  );
}
