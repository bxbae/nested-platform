"use client";

// 고객센터 — 문의를 남기고 답변을 확인하는 화면.
// 신고 처리 알림을 받은 사용자가 이의를 제기하는 통로이기도 하다.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/lib/api/useAuth";
import {
  createInquiry,
  listMyInquiries,
  INQUIRY_STATUS_LABEL,
  type Inquiry,
} from "@/lib/api/inquiries";

const PAGE_SIZE = 10;

type InquiryTab = "OPEN" | "RESOLVED";

function isOpenInquiry(inquiry: Inquiry) {
  return inquiry.status === "RECEIVED" || inquiry.status === "IN_PROGRESS";
}

/**
 * 현재 API가 페이지 단위로 문의를 반환하므로,
 * 모든 문의를 순차적으로 불러온다.
 *
 * 불러온 전체 목록은 프론트에서 진행 중/완료로 나누고
 * 각 탭별로 다시 페이지 처리한다.
 */
async function loadAllMyInquiries(): Promise<Inquiry[]> {
  const rows: Inquiry[] = [];

  let skip = 0;
  let total = 0;

  do {
    const response = await listMyInquiries(PAGE_SIZE, skip);

    rows.push(...response.rows);
    total = response.total;
    skip += response.rows.length;

    if (response.rows.length === 0) {
      break;
    }
  } while (rows.length < total);

  return rows;
}

export default function Support() {
  const { isAuthenticated } = useAuth();

  const [items, setItems] = useState<Inquiry[]>([]);
  const [activeTab, setActiveTab] = useState<InquiryTab>("OPEN");
  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // 펼쳐진 문의 카드 ID
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // 알림을 통해 선택된 문의 강조
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // /support?inquiryId=... 값
  const [targetInquiryId, setTargetInquiryId] = useState<string | null>(null);

  // 같은 inquiryId를 반복해서 처리하지 않도록 한다.
  const handledTargetRef = useRef<string | null>(null);

  /**
   * 알림에서 전달된 문의 ID 확인
   *
   * useSearchParams 대신 브라우저에서 직접 읽어
   * 정적 빌드 시 Suspense 관련 오류를 피한다.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    setTargetInquiryId(params.get("inquiryId"));
  }, []);

  /**
   * 내 문의 전체 불러오기
   */
  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const rows = await loadAllMyInquiries();

        if (!cancelled) {
          setItems(rows);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "문의를 불러오지 못했어요.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const openItems = useMemo(() => items.filter(isOpenInquiry), [items]);

  const resolvedItems = useMemo(
    () => items.filter((item) => item.status === "RESOLVED"),
    [items],
  );

  const filteredItems = activeTab === "OPEN" ? openItems : resolvedItems;

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));

  const visibleItems = useMemo(() => {
    const start = page * PAGE_SIZE;

    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  /**
   * 문의 수가 줄어 현재 페이지가 범위를 벗어나는 경우
   * 마지막 페이지로 이동한다.
   */
  useEffect(() => {
    if (page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

  /**
   * 알림 클릭으로 들어온 경우:
   *
   * 1. 문의 상태 확인
   * 2. 진행 중 또는 완료 탭 자동 선택
   * 3. 해당 문의가 있는 페이지 자동 선택
   * 4. 카드 자동 펼침
   * 5. 카드 위치로 스크롤
   * 6. 잠시 강조
   */
  useEffect(() => {
    if (
      loading ||
      !targetInquiryId ||
      handledTargetRef.current === targetInquiryId
    ) {
      return;
    }

    const target = items.find((item) => item.id === targetInquiryId);

    if (!target) {
      return;
    }

    const targetTab: InquiryTab =
      target.status === "RESOLVED" ? "RESOLVED" : "OPEN";

    const targetItems = targetTab === "OPEN" ? openItems : resolvedItems;

    const targetIndex = targetItems.findIndex((item) => item.id === target.id);

    const targetPage =
      targetIndex >= 0 ? Math.floor(targetIndex / PAGE_SIZE) : 0;

    handledTargetRef.current = targetInquiryId;

    setActiveTab(targetTab);
    setPage(targetPage);

    setExpandedIds((current) => {
      const next = new Set(current);
      next.add(target.id);
      return next;
    });

    setHighlightedId(target.id);

    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`inquiry-${target.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    const highlightTimer = window.setTimeout(() => {
      setHighlightedId(null);
    }, 3000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [items, loading, openItems, resolvedItems, targetInquiryId]);

  function changeTab(tab: InquiryTab) {
    setActiveTab(tab);
    setPage(0);
  }

  function toggleInquiry(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  async function submit() {
    if (sending || !title.trim() || !body.trim()) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const created = await createInquiry({
        title: title.trim(),
        body: body.trim(),
      });

      setItems((current) => [created, ...current]);

      setActiveTab("OPEN");
      setPage(0);

      setExpandedIds((current) => {
        const next = new Set(current);
        next.add(created.id);
        return next;
      });

      setHighlightedId(created.id);

      setTitle("");
      setBody("");
      setSent(true);

      window.setTimeout(() => {
        document.getElementById(`inquiry-${created.id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 150);

      window.setTimeout(() => {
        setHighlightedId(null);
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문의를 보내지 못했어요.");
    } finally {
      setSending(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div
        className="wrap"
        style={{
          paddingTop: 40,
          paddingBottom: 60,
        }}
      >
        <div
          className="card"
          style={{
            padding: 40,
            textAlign: "center",
            maxWidth: 460,
            margin: "40px auto",
          }}
        >
          <strong style={{ fontSize: 18 }}>로그인이 필요해요</strong>

          <p
            style={{
              color: "var(--text-2)",
              marginTop: 8,
              lineHeight: 1.6,
            }}
          >
            답변을 받으실 수 있도록 로그인 후 문의를 남겨주세요.
          </p>

          <Link
            href="/?auth=1"
            className="btn btn-primary press"
            style={{
              marginTop: 18,
            }}
          >
            로그인하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="wrap"
      style={{
        paddingTop: 40,
        paddingBottom: 60,
        maxWidth: 760,
      }}
    >
      <h1
        className="display"
        style={{
          fontSize: 30,
          marginBottom: 6,
        }}
      >
        고객센터
      </h1>

      <p
        style={{
          color: "var(--text-2)",
          marginBottom: 24,
        }}
      >
        운영팀에 직접 문의하실 수 있어요. 답변이 등록되면 알림으로 알려드립니다.
      </p>

      {/* 문의 등록 */}
      <div
        className="card"
        style={{
          padding: 20,
        }}
      >
        <label
          style={{
            display: "block",
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          제목
        </label>

        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setSent(false);
          }}
          placeholder="어떤 점이 궁금하신가요?"
          maxLength={120}
          style={{
            width: "100%",
            marginBottom: 14,
          }}
        />

        <label
          style={{
            display: "block",
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          내용
        </label>

        <textarea
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setSent(false);
          }}
          rows={6}
          placeholder="자세히 적어주시면 더 빠르게 도와드릴 수 있어요."
          maxLength={4000}
          style={{
            width: "100%",
          }}
        />

        {error && (
          <p
            style={{
              fontSize: 13,
              color: "var(--primary)",
              marginTop: 10,
            }}
          >
            {error}
          </p>
        )}

        {sent && (
          <p
            style={{
              fontSize: 13,
              color: "var(--secondary)",
              marginTop: 10,
            }}
          >
            문의가 접수되었어요. 답변이 등록되면 알림으로 알려드릴게요.
          </p>
        )}

        <button
          type="button"
          className="btn btn-primary press"
          style={{
            marginTop: 14,
          }}
          disabled={sending || !title.trim() || !body.trim()}
          onClick={() => void submit()}
        >
          {sending ? "보내는 중…" : "문의 보내기"}
        </button>
      </div>

      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginTop: 40,
          marginBottom: 14,
        }}
      >
        내 문의 내역
      </h2>

      {/* 진행 중 / 완료 탭 */}
      <div
        role="tablist"
        aria-label="문의 상태"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 18,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <InquiryTabButton
          active={activeTab === "OPEN"}
          label="진행 중"
          count={openItems.length}
          onClick={() => changeTab("OPEN")}
        />

        <InquiryTabButton
          active={activeTab === "RESOLVED"}
          label="완료"
          count={resolvedItems.length}
          onClick={() => changeTab("RESOLVED")}
        />
      </div>

      {loading ? (
        <p
          style={{
            color: "var(--text-2)",
          }}
        >
          불러오는 중…
        </p>
      ) : filteredItems.length === 0 ? (
        <div
          className="card"
          style={{
            padding: 32,
            textAlign: "center",
            color: "var(--text-2)",
          }}
        >
          {activeTab === "OPEN"
            ? "진행 중인 문의가 없어요."
            : "완료된 문의가 없어요."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {visibleItems.map((item) => {
            const expanded = expandedIds.has(item.id);

            const highlighted = highlightedId === item.id;

            return (
              <div
                id={`inquiry-${item.id}`}
                key={item.id}
                className="card"
                style={{
                  padding: 18,
                  outline: highlighted
                    ? "2px solid var(--primary)"
                    : "2px solid transparent",
                  outlineOffset: 2,
                  transition: "outline-color 0.25s ease, box-shadow 0.25s ease",
                  boxShadow: highlighted
                    ? "0 8px 28px rgba(0, 0, 0, 0.12)"
                    : undefined,
                }}
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => toggleInquiry(item.id)}
                  style={{
                    width: "100%",
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        minWidth: 0,
                      }}
                    >
                      <strong
                        style={{
                          fontSize: 15,
                        }}
                      >
                        {item.title}
                      </strong>

                      <span
                        className="chip"
                        style={{
                          fontSize: 11,
                          background:
                            item.status === "RESOLVED"
                              ? "var(--secondary)"
                              : undefined,
                          color:
                            item.status === "RESOLVED" ? "#fff" : undefined,
                          border:
                            item.status === "RESOLVED" ? "none" : undefined,
                        }}
                      >
                        {INQUIRY_STATUS_LABEL[item.status]}
                      </span>
                    </div>

                    <span
                      aria-hidden="true"
                      style={{
                        flexShrink: 0,
                        color: "var(--text-2)",
                        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                      }}
                    >
                      ▼
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-2)",
                      marginTop: 8,
                    }}
                  >
                    {new Date(item.createdAt).toLocaleString("ko-KR")}
                  </div>
                </button>

                {expanded && (
                  <div>
                    <InquiryProgress status={item.status} />

                    <p
                      style={{
                        fontSize: 13.5,
                        color: "var(--text-2)",
                        marginTop: 16,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {item.body}
                    </p>

                    {item.answer ? (
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
                          운영팀 답변
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

                        {item.answeredAt && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-2)",
                              marginTop: 8,
                            }}
                          >
                            {new Date(item.answeredAt).toLocaleString("ko-KR")}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: 14,
                          padding: 14,
                          background: "var(--bg-2)",
                          borderRadius: "var(--r-md)",
                          color: "var(--text-2)",
                          fontSize: 13,
                        }}
                      >
                        운영팀에서 문의를 확인하고 있습니다.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            alignItems: "center",
            marginTop: 20,
          }}
        >
          <button
            type="button"
            className="chip"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            이전
          </button>

          <span
            style={{
              fontSize: 13,
              color: "var(--text-2)",
            }}
          >
            {page + 1} / {totalPages}
          </span>

          <button
            type="button"
            className="chip"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((current) => current + 1)}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

function InquiryTabButton({
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

function InquiryProgress({ status }: { status: Inquiry["status"] }) {
  const currentStep =
    status === "RECEIVED" ? 0 : status === "IN_PROGRESS" ? 1 : 2;

  const steps = ["접수 완료", "처리 중", "처리 완료"];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 8,
        marginTop: 18,
      }}
    >
      {steps.map((step, index) => {
        const completed = index <= currentStep;

        return (
          <div
            key={step}
            style={{
              position: "relative",
              textAlign: "center",
            }}
          >
            <div
              style={{
                height: 4,
                borderRadius: 999,
                background: completed ? "var(--secondary)" : "var(--bg-2)",
                marginBottom: 7,
              }}
            />

            <span
              style={{
                fontSize: 11.5,
                fontWeight: completed ? 700 : 500,
                color: completed ? "var(--secondary)" : "var(--text-2)",
              }}
            >
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}
