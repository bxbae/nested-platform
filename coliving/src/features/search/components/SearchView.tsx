"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { BuildingType, House, SearchParams, SortKey } from "@/lib/types";
import {
  BUILDING_TYPE_LABELS,
  RENTAL_UNIT_LABELS,
  ROOM_TYPE_LABELS,
  SHARED_FACILITY_LABELS,
} from "@/lib/types";
import { regionLabel } from "@/lib/seoul";
import { formatStayDuration } from "@/lib/stay-dates";

import { useSearchProperties } from "../api/useSearchProperties";
import { activeFilterCount, filtersToParams, paramsToFilters } from "../schema";

import { PropertyCard, PropertyCardSkeleton } from "./PropertyCard";
import { SearchMap } from "./SearchMap";
import { SearchPropertyPreview } from "./SearchPropertyPreview";
import { FilterSheet } from "./FilterSheet";

const QUICK_BUILDING_TYPES: BuildingType[] = [
  "house",
  "apartment",
  "officetel",
  "studio",
];


const PAGE_SIZE = 9;

type PaginationItem = number | "ellipsis";

function buildPaginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  const sorted = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const result: PaginationItem[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous && page - previous > 1) result.push("ellipsis");
    result.push(page);
  });

  return result;
}

const SORT_OPTIONS: {
  key: SortKey;
  label: string;
}[] = [
  {
    key: "recommended",
    label: "추천순",
  },
  {
    key: "price_asc",
    label: "가격 낮은순",
  },
  {
    key: "price_desc",
    label: "가격 높은순",
  },
  {
    key: "rating",
    label: "평점순",
  },
  {
    key: "newest",
    label: "입주 빠른순",
  },
];

export function SearchView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => paramsToFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [filterOpen, setFilterOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    items,
    total,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
  } = useSearchProperties(filters);

  const filterKey = useMemo(() => filtersToParams(filters).toString(), [filters]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = currentPage * PAGE_SIZE;
  const visibleItems = useMemo(
    () => items.slice(pageStart, pageEnd),
    [items, pageEnd, pageStart],
  );
  const paginationItems = useMemo(
    () => buildPaginationItems(currentPage, totalPages),
    [currentPage, totalPages],
  );

  useEffect(() => {
    setCurrentPage(1);
    setSelectedHouse(null);
    setHover(null);
  }, [filterKey]);

  useEffect(() => {
    const requiredCount = Math.min(pageEnd, total);
    if (
      !isLoading &&
      items.length < requiredCount &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    items.length,
    pageEnd,
    total,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);


  const commit = useCallback(
    (next: SearchParams) => {
      setCurrentPage(1);
      setSelectedHouse(null);
      setHover(null);

      const params = filtersToParams(next);
      const queryString = params.toString();

      router.push(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router],
  );

  const onApplyFilters = (next: SearchParams) => {
    setFilterOpen(false);
    commit(next);
  };

  const setSort = (sort: SortKey) => {
    commit({
      ...filters,
      sort,
    });
  };

  const setQuery = (q: string) => {
    commit({
      ...filters,
      q,
    });
  };

  const toggleQuickBuildingType = (buildingType: BuildingType) => {
    const selected = filters.buildingTypes ?? [];
    const next = selected.includes(buildingType)
      ? selected.filter((item) => item !== buildingType)
      : [...selected, buildingType];
    commit({ ...filters, buildingTypes: next });
  };

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    if (nextPage === currentPage) return;

    setCurrentPage(nextPage);
    setSelectedHouse(null);
    setHover(null);

    window.requestAnimationFrame(() => {
      document.querySelector(".search-results-count")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const activeCount = activeFilterCount(filters);
  const activeHouseId = hover ?? selectedHouse?.id ?? null;

  const hasVisibleFilters =
    Boolean(filters.district) ||
    Boolean(filters.region) ||
    Boolean(filters.verified) ||
    (filters.roomTypes?.length ?? 0) > 0 ||
    (filters.rentalUnits?.length ?? 0) > 0 ||
    (filters.buildingTypes?.length ?? 0) > 0 ||
    (filters.sharedFacilities?.length ?? 0) > 0 ||
    Boolean(filters.checkIn && filters.checkOut);

  return (
    <div className="wrap search-page-shell">
      <div className="search-toolbar">
        <div className="search-toolbar-row">
          <div className="card search-query-field">
            <span aria-hidden="true" />

            <input
              key={filters.q ?? ""}
              defaultValue={filters.q ?? ""}
              placeholder="회사명, 역, 업무지구 또는 숙소명 검색"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setQuery((event.target as HTMLInputElement).value);
                }
              }}
              onBlur={(event) => {
                if (event.target.value !== (filters.q ?? "")) {
                  setQuery(event.target.value);
                }
              }}
              className="search-query-input"
              aria-label="검색어"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={`btn btn-ghost press search-toolbar-control${activeCount > 0 ? " is-active" : ""}`}
            aria-label={activeCount > 0 ? `필터 열기, ${activeCount}개 적용됨` : "필터 열기"}
          >
            <span className="search-toolbar-control-label">필터</span>
            {activeCount > 0 && <span className="filter-active-dot" aria-hidden="true" />}
          </button>

          <div className="search-sort-control">
            <span className="search-sort-display" aria-hidden="true">
              <span>
                {SORT_OPTIONS.find(
                  (option) => option.key === (filters.sort ?? "recommended"),
                )?.label ?? "추천순"}
              </span>
              <svg
                className="search-sort-chevron"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="m6 8 4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <select
              value={filters.sort ?? "recommended"}
              onChange={(event) => setSort(event.target.value as SortKey)}
              aria-label="정렬"
              className="search-sort-select"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowMap((current) => !current)}
            className="btn btn-ghost press map-toggle"
          >
            {showMap ? "리스트만" : "지도 보기"}
          </button>
        </div>

        <div className="quick-building-filter" aria-label="건물 유형 빠른 선택">
          <strong className="quick-building-filter-label">건물 유형</strong>
          <div className="quick-building-filter-options">
            <button
              type="button"
              className="chip press quick-building-chip"
              data-active={(filters.buildingTypes?.length ?? 0) === 0}
              onClick={() => commit({ ...filters, buildingTypes: [] })}
            >
              전체
            </button>
            {QUICK_BUILDING_TYPES.map((buildingType) => (
              <button
                key={buildingType}
                type="button"
                className="chip press quick-building-chip"
                data-active={(filters.buildingTypes ?? []).includes(buildingType)}
                onClick={() => toggleQuickBuildingType(buildingType)}
              >
                {BUILDING_TYPE_LABELS[buildingType]}
              </button>
            ))}
          </div>
          <span className="quick-building-filter-help">
            원하는 건물 유형을 바로 선택해보세요.
          </span>
        </div>

        <div className="search-results-count" role="status" aria-live="polite">
          {isLoading ? "검색 중…" : `${total}개의 숙소`}
        </div>

        {hasVisibleFilters && (
          <div className="search-active-filters">
            {filters.district && (
              <button
                type="button"
                className="chip press"
                onClick={() =>
                  commit({
                    ...filters,
                    district: "",
                    region: "",
                  })
                }
              >
                {filters.district} ×
              </button>
            )}

            {filters.region && (
              <button
                type="button"
                className="chip press"
                onClick={() =>
                  commit({
                    ...filters,
                    region: "",
                  })
                }
              >
                {regionLabel(filters.region)} ×
              </button>
            )}

            {filters.roomTypes?.map((roomType) => (
              <button
                key={roomType}
                type="button"
                className="chip press"
                onClick={() =>
                  commit({
                    ...filters,
                    roomTypes: filters.roomTypes?.filter(
                      (item) => item !== roomType,
                    ),
                  })
                }
              >
                {ROOM_TYPE_LABELS[roomType]} ×
              </button>
            ))}

            {filters.rentalUnits?.map((rentalUnit) => (
              <button
                key={rentalUnit}
                type="button"
                className="chip press"
                onClick={() =>
                  commit({
                    ...filters,
                    rentalUnits: filters.rentalUnits?.filter((item) => item !== rentalUnit),
                  })
                }
              >
                {RENTAL_UNIT_LABELS[rentalUnit]} ×
              </button>
            ))}

            {filters.buildingTypes?.map((buildingType) => (
              <button
                key={buildingType}
                type="button"
                className="chip press"
                onClick={() =>
                  commit({
                    ...filters,
                    buildingTypes: filters.buildingTypes?.filter((item) => item !== buildingType),
                  })
                }
              >
                {BUILDING_TYPE_LABELS[buildingType]} ×
              </button>
            ))}

            {filters.sharedFacilities?.map((facility) => (
              <button
                key={facility}
                type="button"
                className="chip press"
                onClick={() =>
                  commit({
                    ...filters,
                    sharedFacilities: filters.sharedFacilities?.filter((item) => item !== facility),
                  })
                }
              >
                {SHARED_FACILITY_LABELS[facility]} 공유 ×
              </button>
            ))}

            {filters.verified && (
              <button
                type="button"
                className="chip press"
                onClick={() =>
                  commit({
                    ...filters,
                    verified: false,
                  })
                }
              >
                호스트 확인 숙소 ×
              </button>
            )}

            {filters.checkIn && filters.checkOut && (
              <button
                type="button"
                className="chip press"
                onClick={() =>
                  commit({
                    ...filters,
                    checkIn: "",
                    checkOut: "",
                  })
                }
              >
                {filters.checkIn} ~ {filters.checkOut} · {formatStayDuration(filters.checkIn, filters.checkOut)} ×
              </button>
            )}
          </div>
        )}
      </div>

      <div className="search-split">
        <div className="search-results-column">
          {isError && (
            <div
              className="card"
              style={{
                padding: 24,
                textAlign: "center",
              }}
            >
              검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
            </div>
          )}

          <div className="results-grid">
            {isLoading &&
              Array.from({ length: PAGE_SIZE }).map((_, index) => (
                <PropertyCardSkeleton key={index} />
              ))}

            {!isLoading &&
              visibleItems.map((house) => (
                <PropertyCard
                  key={house.id}
                  house={house}
                  onHover={setHover}
                  active={activeHouseId === house.id}
                  onSelect={setSelectedHouse}
                />
              ))}

            {!isLoading &&
              isFetchingNextPage &&
              Array.from({
                length: Math.max(
                  0,
                  Math.min(PAGE_SIZE, total - pageStart) - visibleItems.length,
                ),
              }).map((_, index) => (
                <PropertyCardSkeleton key={`page-loading-${index}`} />
              ))}
          </div>

          {!isLoading && total === 0 && (
            <div
              className="card"
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-2)",
                border: "1px dashed var(--border)",
                background: "transparent",
              }}
            >
              조건에 맞는 숙소가 없습니다. 필터를 넓혀보세요.
            </div>
          )}

          {!isLoading && totalPages > 1 && (
            <nav className="search-pagination" aria-label="숙소 검색 페이지">
              <button
                type="button"
                className="press search-pagination-arrow"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="이전 페이지"
              >
                ‹
              </button>

              <div className="search-pagination-pages">
                {paginationItems.map((item, index) =>
                  item === "ellipsis" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="search-pagination-ellipsis"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className="press search-pagination-page"
                      data-active={item === currentPage}
                      aria-current={item === currentPage ? "page" : undefined}
                      onClick={() => goToPage(item)}
                    >
                      {item}
                    </button>
                  ),
                )}
              </div>

              <button
                type="button"
                className="press search-pagination-arrow"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="다음 페이지"
              >
                ›
              </button>
            </nav>
          )}

          {!isLoading && total > 0 && (
            <p className="search-pagination-summary">
              총 {total}개 중 {pageStart + 1}–{Math.min(pageEnd, total)}개 표시
            </p>
          )}
        </div>

        <div className={`search-map-wrap ${showMap ? "" : "hide-mobile"}`}>
          <SearchMap
            houses={visibleItems}
            hover={activeHouseId}
            onHover={setHover}
            onSelect={setSelectedHouse}
          />
        </div>
      </div>

      {selectedHouse && (
        <SearchPropertyPreview
          house={selectedHouse}
          checkIn={filters.checkIn}
          checkOut={filters.checkOut}
          onClose={() => setSelectedHouse(null)}
        />
      )}

      <FilterSheet
        open={filterOpen}
        initial={filters}
        onApply={onApplyFilters}
        onClose={() => setFilterOpen(false)}
      />
    </div>
  );
}
