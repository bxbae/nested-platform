"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Post } from "@/lib/types";
import { useAuth } from "@/lib/api/useAuth";
import { listPosts, createPost } from "@/lib/api/community";
import { searchRooms } from "@/lib/api/rooms";
import { getPreference, SURVEY, type PreferenceView } from "@/lib/api/preference";
import { UserAvatar } from "@/components/UserAvatar";

const categories = [
  { id: "all", label: "전체" },
  { id: "notice", label: "공지" },
  { id: "event", label: "이벤트" },
  { id: "chore", label: "생활 분담" },
  { id: "market", label: "중고거래" },
  { id: "chat", label: "자유" },
  { id: "seeking", label: "방 구함" },
];

const catColor: Record<string, string> = {
  notice: "#FF5A5F",
  event: "#00A699",
  chore: "#3E9BC4",
  market: "#7C6FE0",
  chat: "#717171",
  seeking: "#E8833A",
};

export default function Community() {
  const [cat, setCat] = useState("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", category: "chat" });
  const { isAuthenticated } = useAuth();
  const [preference, setPreference] = useState<PreferenceView | null>(null);
  const [sharedLifestyleFields, setSharedLifestyleFields] = useState<string[]>([]);
  // Posts hang off a room's board. The UI has no house picker yet, so we post
  // to the first available room — enough to exercise the real relation.
  const [roomId, setRoomId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPosts(await listPosts(cat));
    setLoading(false);
  }, [cat]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getPreference().then((p) => { setPreference(p); if (p?.isCompleted) setSharedLifestyleFields(["noise","cleanliness","smoking","pets"]); }).catch(() => setPreference(null));
    searchRooms({})
      .then((res) => setRoomId(res.items[0]?.id ?? null))
      .catch(() => setRoomId(null));
  }, []);

  async function submit() {
    if (!draft.title.trim() || !roomId) return;
    try {
      await createPost({ roomId, ...draft, sharedLifestyleFields: draft.category === "seeking" ? sharedLifestyleFields : [] });
    } catch {
      return; // guard rejects when signed out; the button is hidden then anyway
    }
    setDraft({ title: "", body: "", category: "chat" });
    setShowNew(false);
    setCat("all");
    load();
  }

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 820 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <span className="eyebrow">Seongsu Loom · house feed</span>
          <h1 className="display" style={{ fontSize: 40, marginTop: 8 }}>
            커뮤니티
          </h1>
        </div>
        {isAuthenticated ? (
          <button className="btn btn-primary" onClick={() => setShowNew((s) => !s)}>
            {showNew ? "닫기" : "글쓰기"}
          </button>
        ) : (
          <Link href="/?auth=1" className="btn btn-ghost press">
            로그인하고 글쓰기
          </Link>
        )}
      </div>

      {showNew && (
        <div className="card" style={{ padding: 20, marginTop: 20, display: "grid", gap: 14 }}>
          <div className="field">
            <label>제목 *</label>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="어떤 이야기를 나누고 싶나요?"
            />
          </div>
          <div className="field">
            <label>내용 *</label>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="상황과 필요한 정보를 자세히 작성해주세요."
              rows={3}
              style={{ padding: 11, border: "1px solid var(--border)", borderRadius: 8, resize: "vertical" }}
            />
          </div>
          <div className="field">
            <label>카테고리 *</label>
            <div style={{ display: "flex", gap: 7 }}>
              {categories.slice(1).map((c) => (
                <button
                  key={c.id}
                  className="chip"
                  data-active={draft.category === c.id}
                  onClick={() => setDraft({ ...draft, category: c.id })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          {draft.category === "seeking" && (
            <div className="field">
              <label>공개할 생활 성향</label>
              {preference?.isCompleted ? (
                <>
                  <p style={{fontSize:12.5,color:"var(--text-2)",marginBottom:8}}>마이페이지에 저장된 성향입니다. 다시 입력하지 않고 공개할 항목만 선택하세요.</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                    {SURVEY.map(({axis,options})=>{const value = preference[axis as keyof PreferenceView];const label=options.find(o=>o.value===value)?.label??value;const checked=sharedLifestyleFields.includes(axis);return <button type="button" key={axis} className="chip" data-active={checked} onClick={()=>setSharedLifestyleFields(v=>checked?v.filter(x=>x!==axis):[...v,axis])}>{checked?"✓ ":""}{label}</button>})}
                  </div>
                </>
              ) : <p style={{fontSize:13,color:"var(--text-2)"}}>생활 성향을 먼저 등록하면 방 구함 글에 자동으로 불러올 수 있습니다.</p>}
            </div>
          )}
          <p style={{fontSize:12.5,color:"var(--text-2)"}}>실명, 전화번호, 이메일, 정확한 주소는 공개 글에 작성하지 마세요. 개인적인 대화는 Nested 메시지를 이용해주세요.</p>
          <button className="btn btn-primary" style={{ justifySelf: "start" }} onClick={submit}>게시글 등록</button>
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "22px 0" }}>
        {categories.map((c) => (
          <button key={c.id} className="chip" data-active={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div style={{ display: "grid", gap: 12 }}>
        {loading && <div style={{ color: "var(--text-2)" }}>게시글을 불러오는 중…</div>}
        {posts.map((p) => (
          <Link
            key={p.id}
            href={`/community/${p.id}`}
            className="card hover-card"
            style={{
              display: "block",
              padding: 18,
              borderLeft: `3px solid ${catColor[p.category]}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  className="chip"
                  style={{
                    background: `${catColor[p.category]}18`,
                    color: catColor[p.category],
                    border: "none",
                    fontSize: 11.5,
                    textTransform: "capitalize",
                  }}
                >
                  {p.category}
                </span>
                {p.pinned && (
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>📌 pinned</span>
                )}
              </div>
              <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                {timeAgo(p.createdAt)}
              </span>
            </div>
            <h3 style={{ fontSize: 17, marginTop: 10 }}>{p.title}</h3>
            <p style={{ fontSize: 14.5, color: "var(--text-2)", marginTop: 6 }}>{p.body}</p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginTop: 12,
                fontSize: 13,
                color: "var(--text-2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserAvatar
                  name={p.author}
                  avatarUrl={p.authorAvatarUrl}
                  avatarColor={p.authorAvatarColor}
                  size={30}
                  fontSize={12}
                />
                <span>{p.author}</span>
              </div>
              <span>💬 {p.replies}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
