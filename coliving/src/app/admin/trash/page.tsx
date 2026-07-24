"use client";

// 휴지통 — 관리자가 지운 커뮤니티 글/댓글을 되돌리는 화면.
// 삭제는 deletedAt 을 찍어두기만 하므로 데이터는 그대로 남아 있고,
// 여기서 복구하면 목록·상세에 다시 나타난다.
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listTrash,
  restorePost,
  restoreComment,
  type TrashedPost,
  type TrashedComment,
} from "@/lib/api/admin";

export default function Trash() {
  const [tab, setTab] = useState<"posts" | "comments">("posts");
  const [posts, setPosts] = useState<TrashedPost[]>([]);
  const [comments, setComments] = useState<TrashedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await listTrash();
        setPosts(res.posts);
        setComments(res.comments);
      } catch (e) {
        setError(e instanceof Error ? e.message : "휴지통을 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 복구는 되돌리기 쉬운 동작이라(다시 지우면 된다) 확인 단계를 두지 않는다.
  async function undeletePost(id: string) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await restorePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "복구하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  async function undeleteComment(id: string) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await restoreComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      // 원글이 함께 살아났을 수 있으므로 게시글 목록도 새로 받아온다.
      const res = await listTrash();
      setPosts(res.posts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "복구하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  const list = tab === "posts" ? posts : comments;

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>휴지통</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 16 }}>
        삭제된 글과 댓글이 보관되어 있어요. 복구하면 원래 자리로 돌아갑니다.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {([
          ["posts", `게시글 ${posts.length}`],
          ["comments", `댓글 ${comments.length}`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className="btn press"
            style={{
              fontSize: 13,
              padding: "8px 16px",
              background: tab === key ? "var(--text)" : "transparent",
              color: tab === key ? "var(--bg)" : "var(--text-2)",
              border: tab === key ? "none" : "1px solid var(--line)",
            }}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      ) : list.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>
          {tab === "posts" ? "삭제된 게시글이 없어요." : "삭제된 댓글이 없어요."}
        </div>
      ) : tab === "posts" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {posts.map((p) => (
            <div key={p.id} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 240, flex: 1 }}>
                <strong style={{ fontSize: 15 }}>{p.title}</strong>
                <p style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 6, whiteSpace: "pre-wrap" }}>
                  {p.body.length > 140 ? `${p.body.slice(0, 140)}…` : p.body}
                </p>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 10 }}>
                  {p.authorName} · 삭제 {new Date(p.deletedAt).toLocaleString("ko-KR")}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <button
                  className="btn btn-primary press"
                  style={{ fontSize: 13, padding: "8px 16px" }}
                  disabled={busy === p.id}
                  onClick={() => void undeletePost(p.id)}
                >
                  {busy === p.id ? "복구 중…" : "복구"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {comments.map((c) => (
            <div key={c.id} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 240, flex: 1 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                  {c.postId ? (
                    <Link href={`/community/${c.postId}`}>{c.postTitle}</Link>
                  ) : (
                    c.postTitle
                  )}
                </div>
                <p style={{ fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap" }}>
                  {c.body.length > 140 ? `${c.body.slice(0, 140)}…` : c.body}
                </p>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 10 }}>
                  {c.authorName} · 삭제 {new Date(c.deletedAt).toLocaleString("ko-KR")}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <button
                  className="btn btn-primary press"
                  style={{ fontSize: 13, padding: "8px 16px" }}
                  disabled={busy === c.id}
                  onClick={() => void undeleteComment(c.id)}
                >
                  {busy === c.id ? "복구 중…" : "복구"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
