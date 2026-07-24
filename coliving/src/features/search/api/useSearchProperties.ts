"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { SearchParams, PaginatedRooms } from "@/lib/types";
import { filtersToParams } from "../schema";
import { searchRooms } from "@/lib/api/rooms";

export function useSearchProperties(filters: SearchParams) {
  const key = filtersToParams(filters).toString();

  const query = useInfiniteQuery({
    queryKey: ["properties", key],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<PaginatedRooms> =>
      searchRooms(filters, pageParam),
    getNextPageParam: (last) => last.nextCursor,
  });

  // 수정 — query.data가 실제로 안 바뀌었으면(예: hover 상태 변경으로 인한
  // 리렌더) items도 같은 배열 참조를 그대로 유지하도록 useMemo로 감쌌다.
  // 안 그러면 .flatMap()이 매 렌더마다 새 배열을 만들어서, 이 값을 쓰는
  // 지도 컴포넌트의 useEffect가 불필요하게 재실행되는 문제가 있었다
  // (지도 확대/축소 후 마우스 이동 시 원본 배율로 리셋되는 버그의 원인).
  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );
  const total = query.data?.pages[0]?.total ?? 0;

  return {
    items,
    total,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isError: query.isError,
  };
}
