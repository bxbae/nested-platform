"use client";

// 문의 관리 — 사용자가 남긴 문의를 확인하고 답변한다.
// 답변을 저장하면 문의자에게 알림이 가고 상태가 완료로 바뀐다.
import { useEffect, useState } from "react";
import {
  listAllInquiries,
  answerInquiry,
  INQUIRY_STATUS_LABEL,
  type AdminInquiry,
  type InquiryStatus,
} from "@/lib/api/inquiries";

const STATUSES: InquiryStatus[] = ["RECEIVED", "IN_PROGRESS", "RESOLVED"];

export default function AdminInquiries() {
  const [items, setItems] = useState<AdminInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 답변 입력 중인 내용을 문의별로 들고 있는다.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function load() {
    try {
      const rows = await listAllInquiries();
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문의를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveAnswer(id: string) {
    const answer = (drafts[id] ?? "").trim();
    if (busy || !answer) return;
    setBusy(id);
    setError(null);
    try {
      await answerInquiry(id, { answer });
      setDrafts((d) => ({ ...d, [id]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "답변을 저장하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(id: string, status: InquiryStatus) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      await answerInquiry(id, { status });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태를 변경하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>문의 관리</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
        답변을 저장하면 문의하신 분께 알림이 전송됩니다.
      </p>

      {error && <p style={{ fontSize: 13, color: "var(--primary)", marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)" }}>
          접수된 문의가 없어요.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {items.map((it) => (
            <div key={it.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 16 }}>{it.title}</strong>
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

              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6 }}>
                {it.authorName} · {it.authorEmail} · {new Date(it.createdAt).toLocaleString("ko-KR")}
              </div>

              <p style={{ fontSize: 14, marginTop: 10, whiteSpace: "pre-wrap" }}>{it.body}</p>

              {it.answer && (
                <div style={{ marginTop: 14, padding: 14, background: "var(--bg-2)", borderRadius: "var(--r-md)" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--secondary)" }}>등록된 답변</div>
                  <p style={{ fontSize: 14, marginTop: 6, whiteSpace: "pre-wrap" }}>{it.answer}</p>
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <textarea
                  value={drafts[it.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [it.id]: e.target.value }))}
                  rows={3}
                  placeholder={it.answer ? "답변을 수정하려면 새로 작성하세요" : "답변을 입력하세요"}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  className="btn btn-primary press"
                  style={{ fontSize: 13, padding: "8px 16px" }}
                  disabled={busy === it.id || !(drafts[it.id] ?? "").trim()}
                  onClick={() => void saveAnswer(it.id)}
                >
                  {busy === it.id ? "저장 중…" : "답변 등록"}
                </button>

                {STATUSES.filter((s) => s !== it.status).map((s) => (
                  <button
                    key={s}
                    className="btn btn-ghost press"
                    style={{ fontSize: 13, padding: "8px 14px" }}
                    disabled={busy === it.id}
                    onClick={() => void changeStatus(it.id, s)}
                  >
                    {INQUIRY_STATUS_LABEL[s]}로 변경
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
