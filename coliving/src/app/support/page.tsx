"use client";

// 고객센터 — 문의를 남기고 답변을 확인하는 화면.
// 신고 처리 알림을 받은 사용자가 이의를 제기하는 통로이기도 하다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/api/useAuth";
import {
  createInquiry,
  listMyInquiries,
  INQUIRY_STATUS_LABEL,
  type Inquiry,
} from "@/lib/api/inquiries";

export default function Support() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    listMyInquiries()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  async function submit() {
    if (sending || !title.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const created = await createInquiry({ title: title.trim(), body: body.trim() });
      setItems((prev) => [created, ...prev]);
      setTitle("");
      setBody("");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문의를 보내지 못했어요.");
    } finally {
      setSending(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div className="card" style={{ padding: 40, textAlign: "center", maxWidth: 460, margin: "40px auto" }}>
          <strong style={{ fontSize: 18 }}>로그인이 필요해요</strong>
          <p style={{ color: "var(--text-2)", marginTop: 8, lineHeight: 1.6 }}>
            답변을 받으실 수 있도록 로그인 후 문의를 남겨주세요.
          </p>
          <Link href="/?auth=1" className="btn btn-primary press" style={{ marginTop: 18 }}>
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 760 }}>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>고객센터</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>
        운영팀에 직접 문의하실 수 있어요. 답변이 등록되면 알림으로 알려드립니다.
      </p>

      <div className="card" style={{ padding: 20 }}>
        <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
          제목
        </label>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSent(false); }}
          placeholder="어떤 점이 궁금하신가요?"
          maxLength={120}
          style={{ width: "100%", marginBottom: 14 }}
        />

        <label style={{ display: "block", fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
          내용
        </label>
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); setSent(false); }}
          rows={6}
          placeholder="자세히 적어주시면 더 빠르게 도와드릴 수 있어요."
          maxLength={4000}
          style={{ width: "100%" }}
        />

        {error && <p style={{ fontSize: 13, color: "var(--primary)", marginTop: 10 }}>{error}</p>}
        {sent && <p style={{ fontSize: 13, color: "var(--secondary)", marginTop: 10 }}>문의가 접수되었어요. 답변이 등록되면 알림으로 알려드릴게요.</p>}

        <button
          className="btn btn-primary press"
          style={{ marginTop: 14 }}
          disabled={sending || !title.trim() || !body.trim()}
          onClick={() => void submit()}
        >
          {sending ? "보내는 중…" : "문의 보내기"}
        </button>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 40, marginBottom: 14 }}>
        내 문의 내역
      </h2>

      {loading ? (
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-2)" }}>
          아직 남긴 문의가 없어요.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((it) => (
            <div key={it.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 15 }}>{it.title}</strong>
                <span
                  className="chip"
                  style={{
                    fontSize: 11,
                    background: it.status === "RESOLVED" ? "var(--secondary)" : undefined,
                    color: it.status === "RESOLVED" ? "#fff" : undefined,
                    border: it.status === "RESOLVED" ? "none" : undefined,
                  }}
                >
                  {INQUIRY_STATUS_LABEL[it.status]}
                </span>
              </div>
              <p style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 8, whiteSpace: "pre-wrap" }}>
                {it.body}
              </p>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 8 }}>
                {new Date(it.createdAt).toLocaleString("ko-KR")}
              </div>

              {it.answer && (
                <div style={{ marginTop: 14, padding: 14, background: "var(--bg-2)", borderRadius: "var(--r-md)" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--secondary)" }}>운영팀 답변</div>
                  <p style={{ fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap" }}>{it.answer}</p>
                  {it.answeredAt && (
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8 }}>
                      {new Date(it.answeredAt).toLocaleString("ko-KR")}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
