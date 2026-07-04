import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchView } from "@/features/search/components/SearchView";

export const metadata: Metadata = {
  title: "숙소 검색 · Nested",
  description:
    "지역, 가격, 방 종류, 입주 가능일로 공유주거 숙소를 검색하세요. 지도와 리스트로 한눈에.",
};

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="wrap" style={{ padding: 40 }}>불러오는 중…</div>}>
      <SearchView />
    </Suspense>
  );
}
