"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/api/useAuth";
import { getPreference } from "@/lib/api/preference";
import type { PreferenceAxis } from "@/lib/api/preference";
import {
  genderLabel,
  getMatches,
  type MatchCandidate,
} from "@/lib/api/match";
import { UserBadges } from "@/components/UserBadges";
import MatchDetailModal from "./MatchDetailModal";

// 9개 설문 항목을 버튼에 쓸 짧은 이름으로 줄인 것. lib/api/preference.ts의
// SURVEY와 축 순서를 맞췄다 — 거기 있는 질문 문장("선호하는 생활 소음
// 수준은?")은 버튼에 쓰기엔 기니까 이 페이지 전용으로 짧게 정의한다.
const AXIS_FILTERS: { axis: PreferenceAxis; label: string }[] = [
  { axis: "noise", label: "소음" },
  { axis: "cleanliness", label: "청결" },
  { axis: "smoking", label: "흡연" },
  { axis: "pets", label: "반려동물" },
  { axis: "visitors", label: "방문객" },
  { axis: "sleep", label: "수면" },
  { axis: "sociability", label: "사교성" },
  { axis: "sharedSpace", label: "공용공간" },
  { axis: "drinking", label: "음주" },
];

export default function Match() {
  const { isAuthenticated } = useAuth();

  const [state, setState] = useState<
    "loading" | "need-survey" | "ready" | "guest"
  >("loading");

  const [results, setResults] = useState<MatchCandidate[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // 선택한 성향 축(예: "noise", "smoking")과 겹치는(=정확히 일치하는)
  // 후보만 남기는 필터. 후보 쪽 일치 축 목록은 이미 results[].matchedAxes에
  // 서버가 계산해서 내려주므로 별도 API 호출 없이 클라이언트에서 필터링한다.
  const [selectedAxes, setSelectedAxes] = useState<PreferenceAxis[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  useEffect(() => {
    if (!isAuthenticated) {
      setState("guest");
      return;
    }

    let alive = true;

    (async () => {
      try {
        const pref = await getPreference();

        if (!alive) return;

        if (!pref?.isCompleted) {
          setState("need-survey");
          return;
        }

        const matches = await getMatches();

        if (!alive) return;

        setResults(matches);
        setState("ready");
      } catch {
        if (alive) {
          setState("need-survey");
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  // 선택한 축을 "전부" 정확히 일치하는 후보만 남긴다(AND). 선택이 없으면 전체.
  const filteredResults = useMemo(() => {
    if (selectedAxes.length === 0) return results;
    return results.filter((m) =>
      selectedAxes.every((axis) => m.matchedAxes.includes(axis)),
    );
  }, [results, selectedAxes]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
  const pagedResults = filteredResults.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // 필터가 바뀌면 1페이지로 되돌린다.
  useEffect(() => {
    setPage(1);
  }, [selectedAxes]);

  function toggleAxis(axis: PreferenceAxis) {
    setSelectedAxes((current) =>
      current.includes(axis)
        ? current.filter((a) => a !== axis)
        : [...current, axis],
    );
  }

  return (
    <>
      <div
        className="wrap"
        style={{
          paddingTop: 40,
          paddingBottom: 60,
          maxWidth: 900,
        }}
      >
        <span className="eyebrow">Roommate match</span>

        <h1
          className="display"
          style={{
            fontSize: 36,
            marginTop: 8,
          }}
        >
          나와 잘 맞는 룸메이트
        </h1>

        <p
          style={{
            color: "var(--text-2)",
            maxWidth: 560,
            marginTop: 8,
            marginBottom: 28,
          }}
        >
          생활 성향 설문을 바탕으로 궁합이 높은 순서대로 보여드려요.
        </p>

        {state === "ready" && (
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 10 }}>
            나와 비슷한 성향 찾기{" "}
              {selectedAxes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedAxes([])}
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    color: "var(--primary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  전체 해제
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {AXIS_FILTERS.map(({ axis, label }) => {
                const active = selectedAxes.includes(axis);
                return (
                  <button
                    key={axis}
                    type="button"
                    className="chip press"
                    onClick={() => toggleAxis(axis)}
                    style={{
                      fontSize: 12.5,
                      border: active
                        ? "1px solid var(--primary)"
                        : "1px solid var(--border)",
                      background: active ? "var(--primary)" : "var(--bg-2)",
                      color: active ? "#fff" : "var(--text)",
                    }}
                  >
                    {active && "✓ "}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {state === "loading" && (
          <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
        )}

        {state === "guest" && (
          <div
            className="card"
            style={{
              padding: 32,
              textAlign: "center",
            }}
          >
            <p
              style={{
                color: "var(--text-2)",
                marginBottom: 16,
              }}
            >
              매칭을 보려면 로그인이 필요해요.
            </p>

            <Link href="/?auth=1" className="btn btn-primary press">
              로그인
            </Link>
          </div>
        )}

        {state === "need-survey" && (
          <div
            className="card"
            style={{
              padding: 32,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              먼저 생활 성향을 알려주세요
            </p>

            <p
              style={{
                color: "var(--text-2)",
                marginBottom: 20,
              }}
            >
              9개 문항에 답하면 잘 맞는 룸메이트를 찾아드려요.
            </p>

            <Link href="/me/preference" className="btn btn-primary press">
              성향 설문 하러 가기
            </Link>
          </div>
        )}

{state === "ready" && results.length === 0 && (
          <div
            className="card"
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--text-2)",
              border: "1px dashed var(--border)",
              background: "transparent",
            }}
          >
            아직 매칭 가능한 상대가 없어요. 더 많은 사용자가 성향을 등록하면
            나타나요.
          </div>
        )}

        {state === "ready" && results.length > 0 && filteredResults.length === 0 && (
          <div
            className="card"
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--text-2)",
              border: "1px dashed var(--border)",
              background: "transparent",
            }}
          >
            선택한 항목이 전부 겹치는 상대가 없어요. 항목을 줄여보세요.
          </div>
        )}

        {state === "ready" && filteredResults.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            }}
          >
            {pagedResults.map((m) => (
              <div
                key={m.userId}
                className="card hover-card"
                role="button"
                tabIndex={0}
                aria-label={`${m.name}님의 매칭 상세 보기`}
                onClick={() => setSelectedUserId(m.userId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedUserId(m.userId);
                  }
                }}
                style={{
                  padding: 20,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: m.avatarUrl
                        ? `center/cover url(${m.avatarUrl})`
                        : m.avatarColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 18,
                    }}
                  >
                    {!m.avatarUrl && m.name.charAt(0)}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ fontSize: 15.5 }}>{m.name}</strong>

                      <UserBadges
                        verified={m.verified}
                        tier={m.tier}
                        tierLabel={m.tierLabel}
                      />
                    </div>

                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--text-2)",
                      }}
                    >
                      {[
                        genderLabel(m.gender),
                        m.ageGroup ? `${m.ageGroup}대` : null,
                        m.job,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: "right",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      className="display"
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: "var(--primary)",
                      }}
                    >
                      {m.score}%
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-2)",
                      }}
                    >
                      궁합
                    </div>
                  </div>
                </div>

                {m.reasons.length > 0 && (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "0 0 12px",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    {m.reasons.map((reason, index) => (
                      <li
                        key={index}
                        style={{
                          fontSize: 13,
                          color: "var(--text-2)",
                        }}
                      >
                        · {reason}
                      </li>
                    ))}
                  </ul>
                )}

                {m.keywords.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {m.keywords.slice(0, 4).map((keyword) => (
                      <span
                        key={keyword}
                        className="chip"
                        style={{
                          fontSize: 11,
                          background: "var(--bg-2)",
                          color: "var(--primary)",
                          border: "none",
                        }}
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            </div>
          )}
  
          {state === "ready" && filteredResults.length > 0 && totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 6,
                marginTop: 28,
              }}
            >
              <button
                type="button"
                className="btn btn-ghost press"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ opacity: page === 1 ? 0.4 : 1 }}
              >
                이전
              </button>
              <span style={{ fontSize: 13, color: "var(--text-2)", margin: "0 8px" }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-ghost press"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ opacity: page === totalPages ? 0.4 : 1 }}
              >
                다음
              </button>
            </div>
          )}
        </div>
  
        <MatchDetailModal
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </>
  );
}
