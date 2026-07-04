"use client";

import { useEffect, useRef } from "react";

// Calls `onIntersect` when the sentinel scrolls into view. Used to trigger
// fetchNextPage for infinite scroll.
export function useInfiniteScroll(
  onIntersect: () => void,
  enabled: boolean
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect();
      },
      { rootMargin: "400px" } // prefetch before the user hits the bottom
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect, enabled]);

  return sentinelRef;
}
