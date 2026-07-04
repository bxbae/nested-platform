"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The hero search entry point. Routes to /search with the query prefilled.
export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const go = () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(params.toString() ? `/search?${params}` : "/search");
  };

  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: 8,
        borderRadius: "var(--r-pill)",
        boxShadow: "var(--shadow-md)",
        maxWidth: 540,
      }}
    >
      <span aria-hidden="true" style={{ paddingLeft: 12, fontSize: 18 }}>
        🔍
      </span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder="지역, 동네, 숙소 이름으로 검색"
        aria-label="숙소 검색"
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 16,
          padding: "8px 4px",
        }}
      />
      <button
        onClick={go}
        className="btn btn-primary press"
        style={{ padding: "12px 24px", whiteSpace: "nowrap" }}
      >
        검색
      </button>
    </div>
  );
}
