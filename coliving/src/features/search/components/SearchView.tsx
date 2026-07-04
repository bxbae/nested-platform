"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { SearchParams, SortKey } from "@/lib/types";
import { useSearchProperties } from "../api/useSearchProperties";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import {
  paramsToFilters,
  filtersToParams,
  activeFilterCount,
} from "../schema";
import { PropertyCard, PropertyCardSkeleton } from "./PropertyCard";
import { SearchMap } from "./SearchMap";
import { FilterSheet } from "./FilterSheet";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "추천순" },
  { key: "price_asc", label: "가격 낮은순" },
  { key: "price_desc", label: "가격 높은순" },
  { key: "rating", label: "평점순" },
  { key: "newest", label: "입주 빠른순" },
];

export function SearchView() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // URL is the source of truth for committed filters
  const filters = useMemo(
    () => paramsToFilters(new URLSearchParams(sp.toString())),
    [sp]
  );

  const [filterOpen, setFilterOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true); // mobile toggle

  const { items, total, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, isError } =
    useSearchProperties(filters);

  const sentinelRef = useInfiniteScroll(fetchNextPage, hasNextPage && !isLoading);

  // commit new filters → push to URL (keeps back button + shareable)
  const commit = useCallback(
    (next: SearchParams) => {
      const params = filtersToParams(next);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  const onApplyFilters = (next: SearchParams) => {
    setFilterOpen(false);
    commit(next);
  };

  const setSort = (sort: SortKey) => commit({ ...filters, sort });
  const setQuery = (q: string) => commit({ ...filters, q });

  const activeCount = activeFilterCount(filters);

  return (
    <div className="wrap" style={{ paddingTop: 24, paddingBottom: 40 }}>
      {/* Sticky search + controls bar */}
      <div
        style={{
          position: "sticky",
          top: 68,
          zIndex: 30,
          background: "var(--glass)",
          backdropFilter: "saturate(160%) blur(18px)",
          WebkitBackdropFilter: "saturate(160%) blur(18px)",
          margin: "0 -28px",
          padding: "14px 28px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              flex: "1 1 260px",
              borderRadius: "var(--r-pill)",
            }}
          >
            <span aria-hidden="true">🔍</span>
            <input
              defaultValue={filters.q ?? ""}
              placeholder="지역, 숙소명으로 검색"
              onKeyDown={(e) => {
                if (e.key === "Enter") setQuery((e.target as HTMLInputElement).value);
              }}
              onBlur={(e) => {
                if (e.target.value !== (filters.q ?? "")) setQuery(e.target.value);
              }}
              style={{ border: "none", outline: "none", flex: 1, background: "transparent", fontSize: 15 }}
              aria-label="검색어"
            />
          </div>

          <button
            onClick={() => setFilterOpen(true)}
            className="btn btn-ghost press"
            style={{ position: "relative" }}
          >
            <span aria-hidden="true">⚙</span> 필터
            {activeCount > 0 && (
              <span
                style={{
                  background: "var(--primary)",
                  color: "#fff",
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px",
                }}
              >
                {activeCount}
              </span>
            )}
          </button>

          <select
            value={filters.sort ?? "recommended"}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="정렬"
            style={{
              padding: "11px 14px",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-pill)",
              background: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>

          {/* mobile map toggle */}
          <button
            onClick={() => setShowMap((s) => !s)}
            className="btn btn-ghost press map-toggle"
          >
            {showMap ? "리스트만" : "지도 보기"}
          </button>
        </div>

        <div
          role="status"
          aria-live="polite"
          style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 10 }}
        >
          {isLoading ? "검색 중…" : `${total}개의 숙소`}
        </div>
      </div>

      {/* Map + list split */}
      <div className="search-split" style={{ marginTop: 20 }}>
        {/* List */}
        <div>
          {isError && (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.
            </div>
          )}

          <div className="results-grid">
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)}

            {!isLoading &&
              items.map((h) => (
                <PropertyCard key={h.id} house={h} onHover={setHover} active={hover === h.id} />
              ))}

            {isFetchingNextPage &&
              Array.from({ length: 2 }).map((_, i) => (
                <PropertyCardSkeleton key={`next-${i}`} />
              ))}
          </div>

          {!isLoading && items.length === 0 && (
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

          {/* infinite scroll sentinel */}
          {hasNextPage && <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />}

          {!hasNextPage && !isLoading && items.length > 0 && (
            <p style={{ textAlign: "center", color: "var(--text-2)", fontSize: 13.5, marginTop: 26 }}>
              모든 숙소를 확인했습니다.
            </p>
          )}
        </div>

        {/* Map */}
        <div className={`search-map-wrap ${showMap ? "" : "hide-mobile"}`}>
          <SearchMap houses={items} hover={hover} onHover={setHover} />
        </div>
      </div>

      <FilterSheet
        open={filterOpen}
        initial={filters}
        onApply={onApplyFilters}
        onClose={() => setFilterOpen(false)}
      />
    </div>
  );
}
