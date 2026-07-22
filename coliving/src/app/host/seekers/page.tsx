"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPosts } from "@/lib/api/community";
import type { Post } from "@/lib/types";

// Host-facing search over "방 구함"(SEEKING) posts — find suitable tenants.
export default function HostSeekers() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(q = "") {
    setLoading(true);
    // Only SEEKING posts; keyword filters title/body (지역·예산 등).
    const rows = await listPosts("seeking", q);
    setPosts(rows);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function onSubmit() {
    load(query);
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>입주 희망자 찾기</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        &lsquo;방 구합니다&rsquo; 게시글을 검색해 내 숙소에 맞는 입주 희망자를 찾아보세요.
      </p>

      {/* search bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="지역·예산·조건으로 검색 (예: 성수동, 60만원, 반려동물)"
          style={{
            flex: 1,
            padding: "11px 14px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            fontSize: 14,
          }}
        />
        <button className="btn btn-primary press" onClick={onSubmit} style={{ padding: "0 20px" }}>
          검색
        </button>
      </div>

      {loading && <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>}

      {!loading && posts.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          조건에 맞는 &lsquo;방 구합니다&rsquo; 게시글이 없습니다.
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {posts.map((p) => (
          <Link
            key={p.id}
            href={`/community/${p.id}`}
            className="card"
            style={{ padding: 20, display: "block" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <strong style={{ fontSize: 16 }}>{p.title}</strong>
                <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 6, lineHeight: 1.5 }}>
                  {p.body.length > 120 ? p.body.slice(0, 120) + "…" : p.body}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 8 }}>
                  {p.author} · {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                  {p.replies > 0 && <> ·  {p.replies}</>}
                </div>
              </div>
              <span className="chip" style={{ fontSize: 11, background: "var(--primary)", color: "#fff", border: "none", whiteSpace: "nowrap" }}>
                방 구함
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
