"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/api/useAuth";
import {
  getPost,
  addComment,
  updateComment,
  deleteComment,
  deletePost,
  updatePost,
  type PostDetail,
  type ApiComment,
  type PostStatus,
} from "@/lib/api/community";
import { UserProfileModal } from "@/components/UserProfileModal";
import { CommunityReportModal } from "@/components/CommunityReportModal";
import { UserAvatar } from "@/components/UserAvatar";

const catColor: Record<string, string> = {
  notice: "#FF5A5F", event: "#00A699", chore: "#3E9BC4",
  market: "#7C6FE0", chat: "#717171", seeking: "#E8833A",
};
const statusLabel: Record<PostStatus, string> = {
  OPEN: "진행 중", IN_PROGRESS: "연락 중", COMPLETED: "완료", CLOSED: "마감",
};
const lifestyleLabels: Record<string, Record<string, string>> = {
  noise: { QUIET: "조용한 환경 선호", MODERATE: "보통 소음", LIVELY: "활기찬 분위기" },
  cleanliness: { VERY_TIDY: "청결 매우 중요", MODERATE: "청결 보통", RELAXED: "정리 기준 여유" },
  smoking: { NON_SMOKING_ONLY: "비흡연 환경", OUTDOOR_OK: "실외 흡연 가능", SMOKING_OK: "흡연 무관" },
  pets: { NO_PETS: "반려동물 없음", CONDITIONAL: "반려동물 조건부", PETS_OK: "반려동물 환영" },
  visitors: { PRIOR_AGREEMENT: "방문객 사전 협의", OCCASIONAL_OK: "가끔 방문 가능", FREQUENT_OK: "방문객 자유" },
  sleep: { EARLY_BIRD: "아침형", FLEXIBLE: "생활 리듬 유동적", NIGHT_OWL: "저녁형" },
  sociability: { PRIVATE: "각자 생활 선호", BALANCED: "적당한 교류", SOCIAL: "교류 선호" },
  sharedSpace: { MINIMAL: "공용공간 최소 사용", MODERATE: "공용공간 보통", COMMUNAL: "공용공간 함께 사용" },
  drinking: { NON_DRINKER: "음주 거의 안 함", SOCIAL_DRINKER: "가끔 음주", FREQUENT: "음주 잦음" },
};

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "COMMUNITY_POST" | "COMMUNITY_COMMENT"; id: string } | null>(null);
  const [editingComment, setEditingComment] = useState<{ id: string; body: string } | null>(null);

  async function reload() {
    setPost(await getPost(id));
  }
  useEffect(() => { reload().finally(() => setLoading(false)); }, [id]);

  const isAuthor = !!user && !!post && user.id === post.authorId;

  async function submitReply() {
    if (!post || !reply.trim() || posting) return;
    setPosting(true);
    try {
      await addComment(
        post.id,
        replyTo ? `@${replyTo.name} ${reply.trim()}` : reply.trim(),
        replyTo?.id,
      );
      setReply(""); setReplyTo(null); await reload();
    } finally { setPosting(false); }
  }
  async function removeComment(id: string) { await deleteComment(id); await reload(); }
  async function saveComment() {
    if (!editingComment?.body.trim()) return;
    await updateComment(editingComment.id, editingComment.body.trim());
    setEditingComment(null); await reload();
  }
  async function savePost() {
    if (!post || !editTitle.trim() || !editBody.trim()) return;
    await updatePost(post.id, { title: editTitle.trim(), body: editBody.trim() });
    setEditing(false); await reload();
  }
  async function removePost() {
    if (!post || !confirm("게시글을 삭제할까요?")) return;
    await deletePost(post.id); router.replace("/community");
  }
  async function sharePost() {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: post?.title ?? "Nested 커뮤니티", url });
    else { await navigator.clipboard.writeText(url); alert("링크를 복사했습니다."); }
  }
  async function changeStatus(status: PostStatus) {
    if (!post) return; await updatePost(post.id, { status }); await reload(); setMenuOpen(false);
  }

  if (loading) return <div className="wrap" style={{ padding: "60px 0", maxWidth: 820 }}>불러오는 중…</div>;
  if (!post) return <div className="wrap" style={{ padding: "60px 0", maxWidth: 820 }}>게시글을 찾을 수 없어요.</div>;

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 820 }}>
      <Link href="/community" style={{ fontSize: 13.5, color: "var(--text-2)" }}>← 커뮤니티</Link>
      <article className="card" style={{ padding: 24, marginTop: 14, borderLeft: `3px solid ${catColor[post.category]}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <span className="chip" style={{ color: catColor[post.category], fontSize: 11.5 }}>{post.category}</span>
            <span className="chip" style={{ fontSize: 11.5 }}>{statusLabel[post.status]}</span>
          </div>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>{timeAgo(post.createdAt)}</span>
            <button className="chip" aria-label="게시글 메뉴" onClick={() => setMenuOpen(v => !v)}>⋯</button>
            {menuOpen && (
              <div className="card" style={{ position: "absolute", right: 0, top: 34, zIndex: 20, minWidth: 160, padding: 8, display: "grid", gap: 5 }}>
                {isAuthor && <>
                  <button className="chip" onClick={() => { setEditTitle(post.title); setEditBody(post.body); setEditing(true); setMenuOpen(false); }}>수정</button>
                  <button className="chip" onClick={() => void removePost()}>삭제</button>
                  <button className="chip" onClick={() => void changeStatus("OPEN")}>진행 중</button>
                  <button className="chip" onClick={() => void changeStatus("IN_PROGRESS")}>연락 중</button>
                  <button className="chip" onClick={() => void changeStatus("COMPLETED")}>완료</button>
                  <button className="chip" onClick={() => void changeStatus("CLOSED")}>마감</button>
                </>}
                <button className="chip" onClick={() => void sharePost()}>링크 공유</button>
                {!isAuthor && <button className="chip" onClick={() => { setReportTarget({ type: "COMMUNITY_POST", id: post.id }); setMenuOpen(false); }}>신고하기</button>}
              </div>
            )}
          </div>
        </div>

        {editing ? <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
          <textarea rows={6} value={editBody} onChange={e => setEditBody(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary" onClick={() => void savePost()}>저장</button><button className="btn btn-ghost" onClick={() => setEditing(false)}>취소</button></div>
        </div> : <>
          <h1 style={{ fontSize: 26, marginTop: 16 }}>{post.title}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.75, marginTop: 14, whiteSpace: "pre-wrap" }}>{post.body}</p>
        </>}

        {post.category === "seeking" && post.lifestyleSnapshot && (
          <div style={{ marginTop: 18, padding: 14, background: "var(--bg-2)", borderRadius: 12 }}>
            <strong style={{ fontSize: 13.5 }}>공개 생활 성향</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {Object.entries(post.lifestyleSnapshot).flatMap(([key, raw]) => {
                const values = Array.isArray(raw) ? raw : [raw];
                return values.map((v, i) => <span key={`${key}-${i}`} className="chip" style={{ fontSize: 12 }}>{lifestyleLabels[key]?.[String(v)] ?? String(v)}</span>);
              })}
            </div>
          </div>
        )}
        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => setProfileUserId(post.authorId)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              background: "none",
              border: 0,
              padding: 0,
              color: "var(--primary)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <UserAvatar
              name={post.author}
              avatarUrl={post.authorAvatarUrl}
              avatarColor={post.authorAvatarColor}
              size={38}
              fontSize={14}
            />
            <span>{post.author}</span>
          </button>
        </div>
      </article>

      <h2 style={{ fontSize: 17, margin: "28px 0 12px" }}>댓글 {post.replies}개</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {post.comments.length === 0 && <p style={{ color: "var(--text-2)" }}>아직 댓글이 없어요.</p>}
        {post.comments.map(comment => <CommentCard key={comment.id} comment={comment} currentUserId={user?.id} onProfile={setProfileUserId} onReply={(id, name) => setReplyTo({ id, name })} onEdit={setEditingComment} onDelete={removeComment} onReport={id => setReportTarget({ type: "COMMUNITY_COMMENT", id })} />)}
      </div>

      <div className="card" style={{ padding: 16, marginTop: 18 }}>
        {isAuthenticated ? <>
          {replyTo && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 8 }}><span><strong>@{replyTo.name}</strong>님에게 답글 작성 중</span><button onClick={() => setReplyTo(null)}>취소</button></div>}
          <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} placeholder={replyTo ? "답글을 입력하세요" : "댓글을 입력하세요"} style={{ width: "100%" }} />
          <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>전화번호·이메일·정확한 주소는 댓글에 남기지 마세요.</p>
          <button className="btn btn-primary" style={{ marginTop: 10 }} disabled={!reply.trim() || posting} onClick={() => void submitReply()}>{posting ? "등록 중…" : replyTo ? "답글 남기기" : "댓글 남기기"}</button>
        </> : <Link href="/?auth=1" className="btn btn-primary">로그인하고 댓글 작성</Link>}
      </div>

      {editingComment && <div role="dialog" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", padding: 20 }}><div className="card" style={{ width: "min(440px,100%)", padding: 20 }}><h3>댓글 수정</h3><textarea rows={4} value={editingComment.body} onChange={e => setEditingComment({ ...editingComment, body: e.target.value })} style={{ width: "100%", marginTop: 12 }} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}><button className="btn btn-ghost" onClick={() => setEditingComment(null)}>취소</button><button className="btn btn-primary" onClick={() => void saveComment()}>저장</button></div></div></div>}
      {reportTarget && <CommunityReportModal type={reportTarget.type} targetId={reportTarget.id} onClose={() => setReportTarget(null)} />}
      <UserProfileModal userId={profileUserId} onClose={() => setProfileUserId(null)} />
    </div>
  );
}

function CommentCard({ comment, currentUserId, onProfile, onReply, onEdit, onDelete, onReport }: {
  comment: ApiComment;
  currentUserId?: string;
  onProfile: (id: string) => void;
  onReply: (id: string, name: string) => void;
  onEdit: (v: { id: string; body: string }) => void;
  onDelete: (id: string) => Promise<void>;
  onReport: (id: string) => void;
}) {
  const mine = currentUserId === comment.author.id;
  const [visibleReplies, setVisibleReplies] = useState(3);
  const replies = comment.replies ?? [];
  const shownReplies = replies.slice(0, visibleReplies);
  const hiddenCount = replies.length - shownReplies.length;

  return (
    <div className="card" style={{ padding: 16 }}>
      <CommentContent
        comment={comment}
        mine={mine}
        onProfile={onProfile}
        onReply={onReply}
        onEdit={onEdit}
        onDelete={onDelete}
        onReport={onReport}
      />

      {shownReplies.length > 0 && (
        <div style={{ marginTop: 12, marginLeft: 18, paddingLeft: 14, borderLeft: "2px solid var(--line)" }}>
          {shownReplies.map((reply) => (
            <div key={reply.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <CommentContent
                comment={reply}
                mine={currentUserId === reply.author.id}
                onProfile={onProfile}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onReport={onReport}
                nested
              />
            </div>
          ))}

          {hiddenCount > 0 && (
            <button
              onClick={() => setVisibleReplies((count) => Math.min(count + 5, replies.length))}
              style={{ marginTop: 10, border: 0, background: "none", color: "var(--primary)", fontWeight: 700, cursor: "pointer" }}
            >
              답글 {hiddenCount}개 더보기
            </button>
          )}
          {visibleReplies > 3 && hiddenCount === 0 && replies.length > 3 && (
            <button
              onClick={() => setVisibleReplies(3)}
              style={{ marginTop: 10, border: 0, background: "none", color: "var(--text-2)", cursor: "pointer" }}
            >
              답글 접기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CommentContent({ comment, mine, onProfile, onReply, onEdit, onDelete, onReport, nested = false }: {
  comment: ApiComment;
  mine: boolean;
  onProfile: (id: string) => void;
  onReply: (id: string, name: string) => void;
  onEdit: (v: { id: string; body: string }) => void;
  onDelete: (id: string) => Promise<void>;
  onReport: (id: string) => void;
  nested?: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <button
          onClick={() => onProfile(comment.author.id)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: 0,
            background: "none",
            padding: 0,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <UserAvatar
            name={comment.author.name}
            avatarUrl={comment.author.avatarUrl}
            avatarColor={comment.author.avatarColor}
            size={nested ? 28 : 34}
            fontSize={nested ? 11 : 13}
          />
          <span>{comment.author.name}</span>
        </button>
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>{timeAgo(comment.createdAt)}</span>
      </div>
      <p style={{ marginTop: 6, whiteSpace: "pre-wrap", fontSize: nested ? 13.5 : 14 }}>{comment.body}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 12 }}>
        <button onClick={() => onReply(comment.id, comment.author.name)}>답글</button>
        {mine ? (
          <>
            <button onClick={() => onEdit({ id: comment.id, body: comment.body })}>수정</button>
            <button onClick={() => void onDelete(comment.id)}>삭제</button>
          </>
        ) : (
          <button onClick={() => onReport(comment.id)}>신고</button>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "방금 전"; if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`; return `${Math.floor(h / 24)}일 전`;
}
