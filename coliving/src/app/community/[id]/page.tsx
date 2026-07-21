"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/api/useAuth";
import {
  getPost,
  addComment,
  deleteComment,
  deletePost,
  updatePost,
  type PostDetail,
  type ApiComment,
} from "@/lib/api/community";
import { UserProfileModal } from "@/components/UserProfileModal";

const catColor: Record<string, string> = {
  notice: "#FF5A5F",
  event: "#00A699",
  chore: "#3E9BC4",
  market: "#7C6FE0",
  chat: "#717171",
};

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);
  // Inline edit state — only the author sees this.
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  // 이름을 누르면 뜨는 공개 프로필. null 이면 닫힌 상태.
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setPost(await getPost(id));
      setLoading(false);
    })();
  }, [id]);

  async function submitReply() {
    const body = reply.trim();
    if (!body || !post || posting) return;
    setPosting(true);
    try {
      const created = await addComment(post.id, body);
      setPost({ ...post, comments: [...post.comments, created], replies: post.replies + 1 });
      setReply("");
    } catch {
      /* session expired or guard rejected — leave the draft in the box */
    } finally {
      setPosting(false);
    }
  }

  async function removeReply(commentId: string) {
    if (!post) return;
    const before = post.comments;
    setPost({
      ...post,
      comments: before.filter((c) => c.id !== commentId),
      replies: Math.max(0, post.replies - 1),
    });
    try {
      await deleteComment(commentId);
    } catch {
      setPost({ ...post, comments: before, replies: post.replies }); // roll back
    }
  }

  function startEdit() {
    if (!post) return;
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditing(true);
  }

  async function saveEdit() {
    if (!post || saving || !editTitle.trim() || !editBody.trim()) return;
    setSaving(true);
    try {
      await updatePost(post.id, { title: editTitle.trim(), body: editBody.trim() });
      // Reflect the change locally so the page doesn't need a refetch.
      setPost({ ...post, title: editTitle.trim(), body: editBody.trim() });
      setEditing(false);
    } catch {
      alert("수정에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function removePost() {
    if (!post) return;
    try {
      await deletePost(post.id);
      router.replace("/community");
    } catch {
      /* not the author */
    }
  }

  if (loading) {
    return (
      <div className="wrap" style={{ padding: "60px 0", maxWidth: 820, color: "var(--text-2)" }}>
        불러오는 중…
      </div>
    );
  }

  if (!post) {
    return (
      <div className="wrap" style={{ padding: "60px 0", maxWidth: 820 }}>
        <p style={{ color: "var(--text-2)" }}>게시글을 찾을 수 없어요.</p>
        <Link href="/community" className="btn btn-ghost press" style={{ marginTop: 16 }}>
          커뮤니티로 돌아가기
        </Link>
      </div>
    );
  }

  const isAuthor = !!user && user.id === post.authorId;

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 820 }}>
      <Link href="/community" style={{ fontSize: 13.5, color: "var(--text-2)" }}>
        ← 커뮤니티
      </Link>

      {/* post */}
      <article
        className="card"
        style={{ padding: 24, marginTop: 14, borderLeft: `3px solid ${catColor[post.category]}` }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            className="chip"
            style={{
              background: `${catColor[post.category]}18`,
              color: catColor[post.category],
              border: "none",
              fontSize: 11.5,
              textTransform: "capitalize",
            }}
          >
            {post.category}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{timeAgo(post.createdAt)}</span>
        </div>

        {editing ? (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="제목"
              style={{
                padding: "10px 12px", border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)", fontSize: 17, fontWeight: 600,
              }}
            />
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="내용"
              rows={6}
              style={{
                padding: "10px 12px", border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)", fontSize: 15, resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-primary press"
                style={{ fontSize: 13, opacity: saving ? 0.6 : 1 }}
                onClick={saveEdit}
                disabled={saving}
              >
                {saving ? "저장 중…" : "저장"}
              </button>
              <button className="btn btn-ghost press" style={{ fontSize: 13 }} onClick={() => setEditing(false)}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="display" style={{ fontSize: 26, marginTop: 12 }}>{post.title}</h1>
            <p style={{ fontSize: 15, marginTop: 10, whiteSpace: "pre-wrap" }}>{post.body}</p>
          </>
        )}

        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 16, fontSize: 13, color: "var(--text-2)",
          }}
        >
          <span>
            by{" "}
            <button
              onClick={() => setProfileUserId(post.authorId)}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                color: "var(--primary)", fontSize: 13, fontWeight: 600,
              }}
            >
              {post.author}
            </button>
          </span>
          {isAuthor && !editing && (
            <span style={{ display: "flex", gap: 4 }}>
              <button className="btn btn-ghost press" style={{ fontSize: 13 }} onClick={startEdit}>
                수정
              </button>
              <button className="btn btn-ghost press" style={{ fontSize: 13 }} onClick={removePost}>
                삭제
              </button>
            </span>
          )}
        </div>
      </article>

      {/* replies */}
      <h2 style={{ fontSize: 17, margin: "28px 0 12px" }}>
        댓글 {post.comments.length}개
      </h2>

      <div style={{ display: "grid", gap: 10 }}>
        {post.comments.length === 0 && (
          <p style={{ color: "var(--text-2)", fontSize: 14 }}>
            아직 댓글이 없어요. 첫 번째로 남겨보세요.
          </p>
        )}
        {post.comments.map((c) => (
          <Reply
            key={c.id}
            comment={c}
            canDelete={!!user && user.id === c.author.id}
            onOpenProfile={() => setProfileUserId(c.author.id)}
            onDelete={() => removeReply(c.id)}
          />
        ))}
      </div>

      {/* reply box */}
      <div className="card" style={{ padding: 16, marginTop: 18 }}>
        {isAuthenticated ? (
          <>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="댓글을 남겨보세요."
              rows={3}
              style={{
                width: "100%", padding: 11, border: "1px solid var(--border)",
                borderRadius: 8, resize: "vertical", fontSize: 14.5,
              }}
            />
            <button
              className="btn btn-primary press"
              style={{ marginTop: 10 }}
              onClick={submitReply}
              disabled={!reply.trim() || posting}
            >
              {posting ? "등록 중…" : "댓글 남기기"}
            </button>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--text-2)", fontSize: 14 }}>
              댓글을 남기려면 로그인이 필요해요.
            </span>
            <Link href="/?auth=1" className="btn btn-primary press">
              로그인
            </Link>
          </div>
        )}
      </div>

      {/* 이름을 누르면 뜨는 공개 프로필 — 여기서 바로 메시지도 보낼 수 있다 */}
      <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
    </div>
  );
}

function Reply({
  comment, canDelete, onDelete, onOpenProfile,
}: {
  comment: ApiComment; canDelete: boolean; onDelete: () => void;
  onOpenProfile: () => void;
}) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={onOpenProfile}
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            fontSize: 13.5, fontWeight: 700, color: "var(--text)",
          }}
        >
          {comment.author.name}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text-2)" }}>{timeAgo(comment.createdAt)}</span>
          {canDelete && (
            <button
              onClick={onDelete}
              style={{
                fontSize: 12, color: "var(--text-2)", background: "none",
                border: "none", cursor: "pointer", padding: 0,
              }}
            >
              삭제
            </button>
          )}
        </div>
      </div>
      <p style={{ fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap" }}>{comment.body}</p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}
