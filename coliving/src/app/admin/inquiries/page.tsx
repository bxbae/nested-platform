"use client";

import { useEffect, useMemo, useState } from "react";
import {
  answerInquiry,
  INQUIRY_STATUS_LABEL,
  listAllInquiries,
  type AdminInquiry,
  type InquiryStatus,
} from "@/lib/api/inquiries";

const STATUSES: InquiryStatus[] = ["RECEIVED", "IN_PROGRESS", "RESOLVED"];

type InquiryTab = "OPEN" | "RESOLVED";

export default function AdminInquiries() {
  const [items, setItems] = useState<AdminInquiry[]>([]);
  const [activeTab, setActiveTab] = useState<InquiryTab>("OPEN");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 문의별 답변 입력 내용을 저장한다.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const openCount = useMemo(
    () =>
      items.filter(
        (item) => item.status === "RECEIVED" || item.status === "IN_PROGRESS",
      ).length,
    [items],
  );

  const resolvedCount = useMemo(
    () => items.filter((item) => item.status === "RESOLVED").length,
    [items],
  );

  const visibleItems = useMemo(() => {
    if (activeTab === "RESOLVED") {
      return items.filter((item) => item.status === "RESOLVED");
    }

    return items.filter(
      (item) => item.status === "RECEIVED" || item.status === "IN_PROGRESS",
    );
  }, [activeTab, items]);

  async function load() {
    setError(null);

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

    if (busy || !answer) {
      return;
    }

    setBusy(id);
    setError(null);

    try {
      await answerInquiry(id, {
        answer,
      });

      setDrafts((current) => ({
        ...current,
        [id]: "",
      }));

      // 답변 등록 시 문의가 완료 처리되므로
      // 새 목록을 받아 완료 탭으로 이동시킨다.
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "답변을 등록하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(id: string, status: InquiryStatus) {
    if (busy) {
      return;
    }

    setBusy(id);
    setError(null);

    try {
      await answerInquiry(id, {
        status,
      });

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태를 변경하지 못했어요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1
        className="display"
        style={{
          fontSize: 30,
          marginBottom: 6,
        }}
      >
        문의 관리
      </h1>

      <p
        style={{
          color: "var(--text-2)",
          marginBottom: 18,
        }}
      >
        문의 답변과 처리 상태를 관리합니다.
      </p>

      {/* 문의 / 완료 탭 */}
      <div
        role="tablist"
        aria-label="문의 상태"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <TabButton
          active={activeTab === "OPEN"}
          label="문의"
          count={openCount}
          onClick={() => setActiveTab("OPEN")}
        />

        <TabButton
          active={activeTab === "RESOLVED"}
          label="완료"
          count={resolvedCount}
          onClick={() => setActiveTab("RESOLVED")}
        />
      </div>

      {error && (
        <p
          style={{
            fontSize: 13,
            color: "var(--primary)",
            marginBottom: 12,
          }}
        >
          {error}
        </p>
      )}

      {loading ? (
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      ) : visibleItems.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--text-2)",
          }}
        >
          {activeTab === "OPEN"
            ? "처리할 문의가 없어요."
            : "완료된 문의가 없어요."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 14,
          }}
        >
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{
                padding: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <strong style={{ fontSize: 16 }}>{item.title}</strong>

                <span
                  className="chip"
                  style={{
                    fontSize: 11,
                    background:
                      item.status === "RESOLVED"
                        ? "var(--secondary)"
                        : undefined,
                    color: item.status === "RESOLVED" ? "#fff" : undefined,
                    border: item.status === "RESOLVED" ? "none" : undefined,
                  }}
                >
                  {INQUIRY_STATUS_LABEL[item.status]}
                </span>
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-2)",
                  marginTop: 6,
                }}
              >
                {item.authorName}
                {" · "}
                {item.authorEmail}
                {" · "}
                {new Date(item.createdAt).toLocaleString("ko-KR")}
              </div>

              <p
                style={{
                  fontSize: 14,
                  marginTop: 10,
                  whiteSpace: "pre-wrap",
                }}
              >
                {item.body}
              </p>

              {item.answer && (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    background: "var(--bg-2)",
                    borderRadius: "var(--r-md)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--secondary)",
                    }}
                  >
                    등록된 답변
                  </div>

                  <p
                    style={{
                      fontSize: 14,
                      marginTop: 6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {item.answer}
                  </p>
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <textarea
                  value={drafts[item.id] ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder={
                    item.answer
                      ? "답변을 수정하려면 새 답변을 입력하세요."
                      : "답변을 입력하세요."
                  }
                  style={{
                    width: "100%",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary press"
                  style={{
                    fontSize: 13,
                    padding: "8px 16px",
                  }}
                  disabled={busy === item.id || !(drafts[item.id] ?? "").trim()}
                  onClick={() => void saveAnswer(item.id)}
                >
                  {busy === item.id
                    ? "저장 중…"
                    : item.answer
                      ? "답변 수정"
                      : "답변 등록"}
                </button>

                {STATUSES.filter((status) => status !== item.status).map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      className="btn btn-ghost press"
                      style={{
                        fontSize: 13,
                        padding: "8px 14px",
                      }}
                      disabled={busy === item.id}
                      onClick={() => void changeStatus(item.id, status)}
                    >
                      {INQUIRY_STATUS_LABEL[status]}
                      으로 변경
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "11px 14px",
        marginBottom: -1,
        border: "none",
        borderBottom: active
          ? "2px solid var(--primary)"
          : "2px solid transparent",
        background: "transparent",
        color: active ? "var(--primary)" : "var(--text-2)",
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {label}

      <span
        style={{
          minWidth: 21,
          height: 21,
          padding: "0 6px",
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: active ? "rgba(255, 90, 95, 0.12)" : "var(--bg-2)",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </button>
  );
}
