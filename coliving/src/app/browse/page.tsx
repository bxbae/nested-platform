"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  BUILDING_TYPE_LABELS,
  RENTAL_UNIT_LABELS,
  SHARED_FACILITY_LABELS,
  type BuildingType,
  type House,
  type RentalUnit,
  type SharedFacility,
} from "@/lib/types";
import { won } from "@/lib/format";
import { commuteBand, jobHubs } from "@/lib/commute";
import { Thumbnail } from "@/components/Thumbnail";
import { regionLabel } from "@/lib/seoul";

const BrowseMap = dynamic(
  () => import("@/components/BrowseMap"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: "100%",
          height: 380,
          background: "var(--secondary-soft)",
        }}
      />
    ),
  },
);

const RENTAL_UNITS: RentalUnit[] = [
  "whole",
  "private_room",
  "bed",
];

const BUILDING_TYPES: BuildingType[] = [
  "house",
  "apartment",
  "officetel",
  "studio",
];

const SHARED_FACILITIES: SharedFacility[] = [
  "bathroom",
  "kitchen",
  "living_room",
  "laundry_room",
  "entrance",
];

const VIBES = [
  "quiet",
  "social",
  "creative",
  "calm",
  "wellness",
  "international",
] as const;

const VIBE_LABELS: Record<string, string> = {
  quiet: "조용한 생활",
  social: "교류가 활발한 곳",
  creative: "창작자 중심",
  calm: "차분한 환경",
  wellness: "건강한 생활",
  international: "국제적인 환경",
};

function toggleValue<T extends string>(
  values: T[],
  value: T,
): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function rentalUnitOf(house: House): RentalUnit {
  if (house.rentalUnit) return house.rentalUnit;
  if (house.roomType === "share_room") return "bed";
  if (house.roomType === "one_room") return "private_room";
  return "whole";
}

function buildingTypeOf(house: House): BuildingType {
  if (house.buildingType) return house.buildingType;
  if (house.roomType === "apartment") return "apartment";
  if (house.roomType === "whole_house") return "house";
  return "studio";
}

export default function Browse() {
  const [hub, setHub] = useState("gangnam");
  const [q, setQ] = useState("");
  const [rentalUnits, setRentalUnits] = useState<RentalUnit[]>([]);
  const [buildingTypes, setBuildingTypes] = useState<BuildingType[]>([]);
  const [sharedFacilities, setSharedFacilities] = useState<SharedFacility[]>([]);
  const [vibes, setVibes] = useState<string[]>([]);
  const [maxRent, setMaxRent] = useState(1_100_000);
  const [maxCommute, setMaxCommute] = useState(60);
  const [sort, setSort] = useState("commute");
  const [results, setResults] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<string | null>(null);

  const activeHub = useMemo(
    () => jobHubs.find((item) => item.id === hub),
    [hub],
  );

  const activeFilterCount =
    rentalUnits.length +
    buildingTypes.length +
    sharedFacilities.length +
    vibes.length +
    (q ? 1 : 0) +
    (maxRent < 1_500_000 ? 1 : 0) +
    (maxCommute < 60 ? 1 : 0);

  const resetFilters = () => {
    setQ("");
    setRentalUnits([]);
    setBuildingTypes([]);
    setSharedFacilities([]);
    setVibes([]);
    setMaxRent(1_100_000);
    setMaxCommute(60);
    setSort("commute");
  };

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        q,
        rentalUnits: rentalUnits.join(","),
        buildingTypes: buildingTypes.join(","),
        sharedFacilities: sharedFacilities.join(","),
        vibes: vibes.join(","),
        maxRent: String(maxRent),
        maxCommute: String(maxCommute),
        hub,
        sort,
      });

      const response = await fetch(`/api/houses?${params}`);

      if (!response.ok) {
        throw new Error("통근 숙소 검색에 실패했습니다.");
      }

      const data = await response.json();
      setResults(data.houses ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [
    buildingTypes,
    hub,
    maxCommute,
    maxRent,
    q,
    rentalUnits,
    sharedFacilities,
    sort,
    vibes,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(load, 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div
      className="wrap commute-browse-page"
      style={{
        paddingTop: 40,
        paddingBottom: 60,
      }}
    >
      <span className="eyebrow">직장 위치를 먼저</span>
      <h1
        className="display"
        style={{
          fontSize: 40,
          marginTop: 8,
          marginBottom: 6,
        }}
      >
        직장과 가까운 숙소 찾기
      </h1>
      <p
        style={{
          color: "var(--text-2)",
          maxWidth: 620,
          lineHeight: 1.65,
        }}
      >
        서울·경기·인천의 주요 업무지구를 기준으로 통근시간이 짧은
        숙소부터 비교합니다. 예약 공간, 건물 유형, 공유 시설은 여러 개를
        동시에 선택할 수 있습니다.
      </p>

      <section className="commute-section">
        <div className="commute-section-heading">
          <div>
            <strong>어디로 출근하시나요?</strong>
            <p>근무지와 가장 가까운 업무지구를 선택하세요.</p>
          </div>
        </div>

        <div className="commute-hub-grid">
          {jobHubs.map((item) => {
            const active = hub === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className="commute-hub-card press"
                data-active={active}
                onClick={() => setHub(item.id)}
              >
                <strong>{item.name}</strong>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card commute-filter-panel">
        <div className="commute-filter-header">
          <div>
            <strong>통근 조건과 숙소 조건</strong>
            <p>
              필요한 조건만 선택하세요. 공유 시설은 선택한 시설을 모두
              갖춘 숙소만 표시합니다.
            </p>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              className="btn btn-ghost press"
              onClick={resetFilters}
            >
              조건 초기화
            </button>
          )}
        </div>

        <div className="commute-basic-grid">
          <label className="field commute-search-field">
            <span>숙소 검색</span>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="지역, 동네 또는 숙소명 검색"
            />
          </label>

          <label className="field">
            <span>최대 통근시간 · {maxCommute}분</span>
            <input
              type="range"
              min={15}
              max={60}
              step={5}
              value={maxCommute}
              onChange={(event) =>
                setMaxCommute(Number(event.target.value))
              }
            />
          </label>

          <label className="field">
            <span>최대 월세 · {won(maxRent)}</span>
            <input
              type="range"
              min={500_000}
              max={1_500_000}
              step={50_000}
              value={maxRent}
              onChange={(event) =>
                setMaxRent(Number(event.target.value))
              }
            />
          </label>

          <label className="field">
            <span>정렬</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="commute">통근시간 짧은 순</option>
              <option value="recommended">추천순</option>
              <option value="price-asc">월세 낮은 순</option>
              <option value="price-desc">월세 높은 순</option>
              <option value="rating">평점 높은 순</option>
            </select>
          </label>
        </div>

        <FilterGroup
          title="예약 공간"
          description="단독형·개인실·다인실을 여러 개 선택할 수 있습니다."
        >
          {RENTAL_UNITS.map((item) => (
            <OptionChip
              key={item}
              active={rentalUnits.includes(item)}
              onClick={() =>
                setRentalUnits((current) =>
                  toggleValue(current, item),
                )
              }
            >
              {RENTAL_UNIT_LABELS[item]}
            </OptionChip>
          ))}
        </FilterGroup>

        <FilterGroup
          title="건물 유형"
          description="선호하는 건물 형태를 복수 선택할 수 있습니다."
        >
          {BUILDING_TYPES.map((item) => (
            <OptionChip
              key={item}
              active={buildingTypes.includes(item)}
              onClick={() =>
                setBuildingTypes((current) =>
                  toggleValue(current, item),
                )
              }
            >
              {BUILDING_TYPE_LABELS[item]}
            </OptionChip>
          ))}
        </FilterGroup>

        <FilterGroup
          title="공유 시설"
          description="선택한 시설을 모두 갖춘 숙소만 표시합니다."
        >
          {SHARED_FACILITIES.map((item) => (
            <OptionChip
              key={item}
              active={sharedFacilities.includes(item)}
              onClick={() =>
                setSharedFacilities((current) =>
                  toggleValue(current, item),
                )
              }
            >
              {SHARED_FACILITY_LABELS[item]}
            </OptionChip>
          ))}
        </FilterGroup>

        <FilterGroup
          title="생활 분위기"
          description="하나 이상 선택하면 선택한 분위기 중 하나와 맞는 숙소를 표시합니다."
        >
          {VIBES.map((item) => (
            <OptionChip
              key={item}
              active={vibes.includes(item)}
              onClick={() =>
                setVibes((current) =>
                  toggleValue(current, item),
                )
              }
            >
              {VIBE_LABELS[item]}
            </OptionChip>
          ))}
        </FilterGroup>

        <div className="commute-date-note">
          정확한 입주일·퇴실일과 최소 계약 기간은{" "}
          <Link href="/search">일반 숙소 검색</Link>에서 추가로 설정할 수
          있습니다.
        </div>
      </section>

      <div className="browse-layout">
        <div>
          <div
            style={{
              color: "var(--text-2)",
              fontSize: 14,
              marginBottom: 14,
            }}
          >
            {loading
              ? "검색 중…"
              : `${activeHub?.name ?? "목적지"}까지 ${maxCommute}분 이내 숙소 ${results.length}곳`}
          </div>

          <div className="results-grid">
            {results.map((house) => {
              const band = house.commute
                ? commuteBand(house.commute.minutes)
                : null;
              const rentalUnit = rentalUnitOf(house);
              const buildingType = buildingTypeOf(house);

              return (
                <Link
                  key={house.id}
                  href={`/homes/${house.id}?hub=${hub}`}
                  className="card hover-card"
                  onMouseEnter={() => setHover(house.id)}
                  onMouseLeave={() => setHover(null)}
                  style={{ overflow: "hidden" }}
                >
                  <Thumbnail
                    src={house.photo}
                    color={house.color}
                    height={168}
                  >
                    <div className="commute-card-overlay">
                      {house.commute && band && (
                        <span
                          className="chip glass"
                          style={{
                            background: band.color,
                            color: "#fff",
                            border: "none",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {house.commute.mode === "walk"
                            ? "도보"
                            : "대중교통"}{" "}
                          {house.commute.minutes}분
                        </span>
                      )}

                      {rentalUnit === "bed" && (
                        <span
                          className="chip glass"
                          style={{
                            border: "none",
                            color: "#18181b",
                          }}
                        >
                          {house.residents}/{house.capacity ?? 2}자리
                        </span>
                      )}
                    </div>
                  </Thumbnail>

                  <div style={{ padding: 14 }}>
                    <div className="commute-result-title">
                      <strong>{house.name.trim()}</strong>
                      <span>★ {house.rating}</span>
                    </div>

                    <div className="commute-result-meta">
                      {regionLabel(house.neighborhood)}
                      {house.commute && band && (
                        <span
                          style={{
                            color: band.color,
                            fontWeight: 700,
                          }}
                        >
                          {" · "}
                          {band.label.toLowerCase()}
                        </span>
                      )}
                    </div>

                    <div className="commute-result-tags">
                      <span className="chip">
                        {RENTAL_UNIT_LABELS[rentalUnit]}
                      </span>
                      <span className="chip">
                        {BUILDING_TYPE_LABELS[buildingType]}
                      </span>
                      {(house.sharedFacilities ?? [])
                        .slice(0, 2)
                        .map((facility) => (
                          <span key={facility} className="chip">
                            {SHARED_FACILITY_LABELS[facility]}
                          </span>
                        ))}
                    </div>

                    <div style={{ marginTop: 12, fontSize: 14 }}>
                      <strong>{won(house.monthlyRent)}</strong>
                      <span
                        style={{
                          color: "var(--text-2)",
                          fontSize: 13,
                        }}
                      >
                        {" "}
                        / 월
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {!loading && results.length === 0 && (
            <div
              className="card"
              style={{
                padding: 30,
                textAlign: "center",
                color: "var(--text-2)",
              }}
            >
              조건에 맞는 숙소가 없습니다. 통근시간, 월세 또는 선택한 시설
              조건을 줄여보세요.
            </div>
          )}
        </div>

        <div className="map-sticky">
          <div
            className="card"
            style={{
              padding: 0,
              overflow: "hidden",
            }}
          >
            <div className="commute-map-header">
              <strong>
                {activeHub?.name ?? ""}까지 통근 거리
              </strong>
              <span>◆ 직장</span>
            </div>

            {activeHub && (
              <BrowseMap
                houses={results}
                hover={hover}
                onHover={setHover}
                hub={activeHub}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="commute-filter-group">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="commute-filter-options">{children}</div>
    </div>
  );
}

function OptionChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="chip press commute-option-chip"
      data-active={active}
      onClick={onClick}
    >
      {active && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}
