"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { SearchParams, PaginatedRooms } from "@/lib/types";
import { filtersToParams } from "../schema";
import { searchRooms } from "@/lib/api/rooms";

// Real TanStack Query implementation. queryKey = serialized filters,
// getNextPageParam = the cursor returned by the API. The actual fetch is
// delegated to searchRooms(), which targets the NestJS API or the demo
// Route Handler depending on NEXT_PUBLIC_USE_REAL_API.
export function useSearchProperties(filters: SearchParams) {
  const key = filtersToParams(filters).toString();

  const query = useInfiniteQuery({
    queryKey: ["properties", key],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<PaginatedRooms> =>
      searchRooms(filters, pageParam),
    getNextPageParam: (last) => last.nextCursor,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
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
