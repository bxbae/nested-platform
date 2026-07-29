"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  CalendarDays,
  DoorOpen,
  MapPin,
  Star,
  Users,
  X,
} from "lucide-react";

import { Thumbnail } from "@/components/Thumbnail";
import { won } from "@/lib/format";
import { regionLabel } from "@/lib/seoul";
import type { House } from "@/lib/types";
import {
  GENDER_LABELS,
  getAccommodationLabel,
  getPriceUnitLabel,
} from "@/lib/types";

function formatDate(value?: string | null) {
  if (!value) return "문의 필요";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function SearchPropertyPreview({
  house,
  checkIn,
  checkOut,
  onClose,
}: {
  house: House;
  checkIn?: string;
  checkOut?: string;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const detailParams = new URLSearchParams();
  if (checkIn) detailParams.set("checkIn", checkIn);
  if (checkOut) detailParams.set("checkOut", checkOut);

  const detailHref = `/homes/${house.id}${
    detailParams.size ? `?${detailParams.toString()}` : ""
  }`;

  const inventory = house.inventory;
  const featureLabels = [
    house.parking ? "주차 가능" : null,
    house.petsAllowed ? "반려동물 가능" : null,
    house.smokingAllowed ? "흡연 가능" : "금연",
    house.genderPolicy !== "any" ? GENDER_LABELS[house.genderPolicy] : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="search-preview-layer">
      <button
        type="button"
        className="search-preview-backdrop"
        onClick={onClose}
        aria-label="숙소 미리보기 닫기"
      />

      <aside
        className="search-preview-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-preview-title"
      >
        <div className="search-preview-scroll">
          <div className="search-preview-media">
            <Thumbnail
              src={house.photo}
              color={house.color}
              height="238px"
            >
              <div className="search-preview-media-overlay">
                <span className="chip glass search-preview-type-chip">
                  {getAccommodationLabel(house)}
                </span>
              </div>
            </Thumbnail>

            <button
              ref={closeButtonRef}
              type="button"
              className="press search-preview-close"
              onClick={onClose}
              aria-label="닫기"
            >
              <X size={20} />
            </button>
          </div>

          <div className="search-preview-content">
            <div className="search-preview-heading-row">
              <div className="search-preview-heading-copy">
                <h2 id="search-preview-title">{house.name.trim()}</h2>
                <div className="search-preview-location">
                  <MapPin size={14} />
                  <span>
                    {regionLabel(house.region)} · 리뷰 {house.reviews}개
                  </span>
                </div>
              </div>

              <span className="search-preview-rating">
                <Star size={14} fill="var(--primary)" stroke="var(--primary)" />
                {house.rating}
              </span>
            </div>

            <div className="search-preview-price">
              <strong>{won(house.monthlyRent)}</strong>
              <span> / 월 · {getPriceUnitLabel(house.rentalUnit)}</span>
            </div>

            {featureLabels.length > 0 && (
              <div className="search-preview-feature-row">
                {featureLabels.map((label) => (
                  <span key={label} className="chip search-preview-feature-chip">
                    {label}
                  </span>
                ))}
              </div>
            )}

            <section className="search-preview-section" aria-label="숙소 기본 정보">
              <h3>숙소 정보</h3>
              <div className="search-preview-summary-grid">
                <div>
                  <DoorOpen size={17} />
                  <span>방</span>
                  <strong>{house.bedrooms ?? "-"}개</strong>
                </div>
                <div>
                  <Users size={17} />
                  <span>최대 인원</span>
                  <strong>{house.capacity ?? "-"}명</strong>
                </div>
                <div>
                  <CalendarDays size={17} />
                  <span>최소 거주</span>
                  <strong>{house.minStayMonths}개월</strong>
                </div>
              </div>
            </section>

            <section className="search-preview-section" aria-label="비용 정보">
              <h3>비용</h3>
              <dl className="search-preview-cost-list">
                <div>
                  <dt>월세</dt>
                  <dd>{won(house.monthlyRent)}</dd>
                </div>
                <div>
                  <dt>보증금</dt>
                  <dd>{won(house.deposit)}</dd>
                </div>
                <div>
                  <dt>관리비</dt>
                  <dd>{won(house.maintenanceFee)}</dd>
                </div>
                <div>
                  <dt>청소비</dt>
                  <dd>{won(house.cleaningFee)}</dd>
                </div>
              </dl>
            </section>

            <section className="search-preview-section" aria-label="입주 정보">
              <h3>입주 정보</h3>
              <dl className="search-preview-cost-list">
                <div>
                  <dt>입주 가능일</dt>
                  <dd>{formatDate(house.availableFrom)}</dd>
                </div>
                {checkIn && checkOut && (
                  <div>
                    <dt>선택 기간</dt>
                    <dd>
                      {checkIn} ~ {checkOut}
                    </dd>
                  </div>
                )}
                {inventory && (
                  <div>
                    <dt>예약 상태</dt>
                    <dd>
                      {inventory.blocked
                        ? "호스트 차단"
                        : inventory.fullyBooked
                          ? "예약 마감"
                          : inventory.remainingSpots != null
                            ? `잔여 ${inventory.remainingSpots}자리`
                            : "예약 가능"}
                    </dd>
                  </div>
                )}
              </dl>
            </section>

            {(house.blurb || house.description) && (
              <section className="search-preview-section search-preview-description">
                <h3>숙소 소개</h3>
                <p>{house.blurb || house.description}</p>
              </section>
            )}
          </div>
        </div>

        <div className="search-preview-actions">
          <Link href={detailHref} className="btn btn-primary press search-preview-detail-button">
            상세보기
          </Link>
        </div>
      </aside>
    </div>
  );
}
