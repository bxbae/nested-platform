"use client";

import { useEffect, useState } from "react";
import type {
  BuildingType,
  GenderPolicy,
  RentalUnit,
  SearchParams,
  SharedFacility,
} from "@/lib/types";
import {
  BUILDING_TYPE_LABELS,
  GENDER_LABELS,
  RENTAL_UNIT_LABELS,
  SHARED_FACILITY_LABELS,
} from "@/lib/types";
import { won } from "@/lib/format";
import { DISTRICT_OPTIONS } from "@/lib/seoul";
import { getLegalNeighborhoods, type LegalRegionOption } from "@/lib/api/regions";
import { DEFAULT_FILTERS, RENT_MAX, RENT_MIN } from "../schema";

const GENDERS: GenderPolicy[] = ["any", "female_only", "male_only"];
const RENTAL_UNITS: RentalUnit[] = ["whole", "private_room", "bed"];
const BUILDING_TYPES: BuildingType[] = ["studio", "apartment", "house"];
const SHARED_FACILITIES: SharedFacility[] = [
  "bathroom",
  "kitchen",
  "living_room",
  "laundry_room",
  "entrance",
];

export function FilterSheet({
  open,
  initial,
  onApply,
  onClose,
}: {
  open: boolean;
  initial: SearchParams;
  onApply: (filters: SearchParams) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SearchParams>(initial);
  const [neighborhoods, setNeighborhoods] = useState<LegalRegionOption[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsError, setRegionsError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!draft.district) {
      setNeighborhoods([]);
      setRegionsError(null);
      return;
    }

    let cancelled = false;
    setRegionsLoading(true);
    setRegionsError(null);

    getLegalNeighborhoods(draft.district)
      .then((items) => {
        if (!cancelled) setNeighborhoods(items);
      })
      .catch((error) => {
        if (!cancelled) {
          setNeighborhoods([]);
          setRegionsError(
            error instanceof Error
              ? error.message
              : "법정동 목록을 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setRegionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [draft.district]);

  if (!open) {
    return null;
  }

  const set = (patch: Partial<SearchParams>) => {
    setDraft((current) => ({
      ...current,
      ...patch,
    }));
  };


  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 100,
          animation: "fadeIn .2s ease",
        }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-label="검색 필터"
        aria-modal="true"
        className="filter-drawer"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            background: "var(--bg)",
            zIndex: 1,
          }}
        >
          <strong style={{ fontSize: 17 }}>필터</strong>

          <button
            type="button"
            onClick={onClose}
            className="press"
            aria-label="닫기"
            style={{
              fontSize: 22,
              lineHeight: 1,
              color: "var(--text-2)",
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: 22,
            display: "grid",
            gap: 26,
          }}
        >
          <Section title="지역(구)">
            <p
              style={{
                fontSize: 12.5,
                color: "var(--text-2)",
                marginBottom: 12,
              }}
            >
              구를 선택하면 해당 지역의 세부 동을 선택할 수 있습니다.
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="chip"
                data-active={!draft.district}
                onClick={() =>
                  set({
                    district: "",
                    region: "",
                    legalDongCode: "",
                  })
                }
              >
                전체
              </button>

              {DISTRICT_OPTIONS.map((item) => {
                const active = draft.district === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    className="chip"
                    data-active={active}
                    onClick={() =>
                      set({
                        district: active ? "" : item.value,
                        region: "",
                        legalDongCode: "",
                      })
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {draft.district && (
            <Section title="세부 지역(동)">
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--text-2)",
                  marginBottom: 12,
                }}
              >
                동을 선택하지 않으면 {draft.district} 전체 숙소를 검색합니다.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="chip"
                  data-active={!draft.region}
                  onClick={() =>
                    set({
                      region: "",
                      legalDongCode: "",
                    })
                  }
                >
                  전체
                </button>

                {neighborhoods.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className="chip"
                    data-active={draft.legalDongCode === item.code}
                    onClick={() => {
                      const active = draft.legalDongCode === item.code;
                      set({
                        region: active ? "" : item.neighborhood,
                        legalDongCode: active ? "" : item.code,
                      });
                    }}
                  >
                    {item.neighborhood}
                  </button>
                ))}

                {regionsLoading && (
                  <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                    법정동을 불러오는 중…
                  </span>
                )}

                {!regionsLoading && regionsError && (
                  <span style={{ fontSize: 13, color: "var(--primary)" }}>
                    {regionsError}
                  </span>
                )}

                {!regionsLoading && !regionsError && neighborhoods.length === 0 && (
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-2)",
                    }}
                  >
                    등록된 세부 지역이 없습니다.
                  </span>
                )}
              </div>
            </Section>
          )}

          <Section title="안심 조건">
            <ToggleRow
              label="호스트 확인 숙소만"
              value={Boolean(draft.verified)}
              onChange={(value) =>
                set({
                  verified: value,
                })
              }
            />
          </Section>

          <Section title="숙소 유형">
            <p style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 12 }}>
              예약 공간, 건물 유형, 공유 시설을 각각 선택할 수 있습니다.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              <MultiSelectDropdown
                label="예약 공간"
                placeholder="전체 숙소 유형"
                values={draft.rentalUnits ?? []}
                options={RENTAL_UNITS}
                labels={RENTAL_UNIT_LABELS}
                onChange={(rentalUnits) => set({ rentalUnits })}
              />
              <MultiSelectDropdown
                label="건물 유형"
                placeholder="전체 건물"
                values={draft.buildingTypes ?? []}
                options={BUILDING_TYPES}
                labels={BUILDING_TYPE_LABELS}
                onChange={(buildingTypes) => set({ buildingTypes })}
              />
              <MultiSelectDropdown
                label="공유 시설"
                placeholder="공유 시설 전체"
                values={draft.sharedFacilities ?? []}
                options={SHARED_FACILITIES}
                labels={SHARED_FACILITY_LABELS}
                onChange={(sharedFacilities) => set({ sharedFacilities })}
              />
            </div>
          </Section>

          <Section title="가격 (월세)">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              <span>{won(draft.minRent ?? RENT_MIN)}</span>

              <span>
                {won(draft.maxRent ?? RENT_MAX)}
                {(draft.maxRent ?? RENT_MAX) >= RENT_MAX ? "+" : ""}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                }}
              >
                최소
              </label>

              <input
                type="range"
                min={RENT_MIN}
                max={RENT_MAX}
                step={10000}
                value={draft.minRent ?? RENT_MIN}
                onChange={(event) => {
                  const value = Number(event.target.value);

                  set({
                    minRent: Math.min(value, draft.maxRent ?? RENT_MAX),
                  });
                }}
              />

              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                }}
              >
                최대
              </label>

              <input
                type="range"
                min={RENT_MIN}
                max={RENT_MAX}
                step={10000}
                value={draft.maxRent ?? RENT_MAX}
                onChange={(event) => {
                  const value = Number(event.target.value);

                  set({
                    maxRent: Math.max(value, draft.minRent ?? RENT_MIN),
                  });
                }}
              />
            </div>
          </Section>

          <Section title="입주 가능일">
            <input
              type="date"
              value={draft.availableFrom ?? ""}
              onChange={(event) =>
                set({
                  availableFrom: event.target.value,
                })
              }
              style={{
                padding: "11px 14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                width: "100%",
              }}
            />

            <p
              style={{
                fontSize: 12.5,
                color: "var(--text-2)",
                marginTop: 6,
              }}
            >
              선택한 날짜에 입주 가능한 숙소만 표시됩니다.
            </p>
          </Section>

          <Section title="방 개수">
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  className="chip"
                  data-active={draft.minBedrooms === count}
                  onClick={() =>
                    set({
                      minBedrooms:
                        draft.minBedrooms === count ? undefined : count,
                    })
                  }
                >
                  {count}개 이상
                </button>
              ))}
            </div>
          </Section>

          <Section title="함께 지낼 인원">
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {[2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  className="chip"
                  data-active={draft.minCapacity === count}
                  onClick={() =>
                    set({
                      minCapacity:
                        draft.minCapacity === count ? undefined : count,
                    })
                  }
                >
                  {count}명 이상
                </button>
              ))}
            </div>
          </Section>

          <Section title="성별">
            <div
              style={{
                display: "flex",
                gap: 8,
              }}
            >
              {GENDERS.map((gender) => (
                <button
                  key={gender}
                  type="button"
                  className="chip"
                  data-active={(draft.gender ?? "any") === gender}
                  onClick={() =>
                    set({
                      gender,
                    })
                  }
                  style={{
                    flex: 1,
                    justifyContent: "center",
                  }}
                >
                  {GENDER_LABELS[gender]}
                </button>
              ))}
            </div>
          </Section>

          <Section title="옵션">
            <div
              style={{
                display: "grid",
                gap: 4,
              }}
            >
              <ToggleRow
                label="반려동물 가능"
                value={Boolean(draft.pets)}
                onChange={(value) =>
                  set({
                    pets: value,
                  })
                }
              />

              <ToggleRow
                label="흡연 가능"
                value={Boolean(draft.smoking)}
                onChange={(value) =>
                  set({
                    smoking: value,
                  })
                }
              />

              <ToggleRow
                label="주차 가능"
                value={Boolean(draft.parking)}
                onChange={(value) =>
                  set({
                    parking: value,
                  })
                }
              />
            </div>
          </Section>
        </div>

        <div
          style={{
            position: "sticky",
            bottom: 0,
            display: "flex",
            gap: 12,
            padding: "16px 22px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg)",
          }}
        >
          <button
            type="button"
            className="btn btn-ghost press"
            style={{
              flex: "0 0 auto",
            }}
            onClick={() =>
              setDraft({
                ...DEFAULT_FILTERS,
                q: draft.q,
                sort: draft.sort,
              })
            }
          >
            초기화
          </button>

          <button
            type="button"
            className="btn btn-primary press"
            style={{
              flex: 1,
              justifyContent: "center",
            }}
            onClick={() => onApply(draft)}
          >
            적용하기
          </button>
        </div>
      </div>
    </>
  );
}


function MultiSelectDropdown<T extends string>({
  label,
  placeholder,
  values,
  options,
  labels,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: T[];
  options: T[];
  labels: Record<T, string>;
  onChange: (values: T[]) => void;
}) {
  const summary = values.length
    ? values.map((value) => labels[value]).join(", ")
    : placeholder;

  return (
    <details
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
        background: "var(--surface)",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          padding: "12px 14px",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>
        <span
          style={{
            minWidth: 0,
            color: values.length ? "var(--text)" : "var(--text-2)",
            fontSize: 13,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </span>
      </summary>
      <div
        style={{
          padding: "0 14px 12px",
          display: "grid",
          gap: 8,
          borderTop: "1px solid var(--border)",
        }}
      >
        <label style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 10, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={values.length === 0}
            onChange={() => onChange([])}
          />
          전체
        </label>
        {options.map((option) => (
          <label key={option} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={values.includes(option)}
              onChange={() =>
                onChange(
                  values.includes(option)
                    ? values.filter((value) => value !== option)
                    : [...values, option],
                )
              }
            />
            {labels[option]}
          </label>
        ))}
      </div>
    </details>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      {children}
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        fontSize: 15,
      }}
      role="switch"
      aria-checked={value}
    >
      <span>{label}</span>

      <span
        style={{
          width: 44,
          height: 26,
          borderRadius: 99,
          background: value ? "var(--secondary)" : "var(--border)",
          position: "relative",
          transition: "background .15s ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 20 : 2,
            width: 22,
            height: 22,
            borderRadius: 99,
            background: "var(--surface)",
            transition: "left .18s cubic-bezier(.2,.8,.3,1)",
            boxShadow: "var(--shadow-sm)",
          }}
        />
      </span>
    </button>
  );
}
