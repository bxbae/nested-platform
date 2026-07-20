"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/api/useAuth";
import { getPreference } from "@/lib/api/preference";
import { getMatches, type MatchCandidate } from "@/lib/api/match";
import { UserBadges } from "@/components/UserBadges";

// 룸메이트 매칭 (성향 기반). Gated on a completed survey: if the user hasn't
// filled it in, we point them to /me/preference instead of showing an empty
// or fabricated result (스토리보드 07).
export default function Match() {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<"loading" | "need-survey" | "ready" | "guest">("loading");
  const [results, setResults] = useState<MatchCandidate[]>([]);

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
        if (alive) setState("need-survey");
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 900 }}>
      <span className="eyebrow">Roommate match</span>
      <h1 className="display" style={{ fontSize: 36, marginTop: 8 }}>나와 잘 맞는 룸메이트</h1>
      <p style={{ color: "var(--text-2)", maxWidth: 560, marginTop: 8, marginBottom: 28 }}>
        생활 성향 설문을 바탕으로 궁합이 높은 순서대로 보여드려요.
      </p>

      {state === "loading" && <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>}

      {state === "guest" && (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "var(--text-2)", marginBottom: 16 }}>매칭을 보려면 로그인이 필요해요.</p>
          <Link href="/?auth=1" className="btn btn-primary press">로그인</Link>
        </div>
      )}

      {state === "need-survey" && (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>먼저 생활 성향을 알려주세요</p>
          <p style={{ color: "var(--text-2)", marginBottom: 20 }}>
            9개 문항에 답하면 잘 맞는 룸메이트를 찾아드려요.
          </p>
          <Link href="/me/preference" className="btn btn-primary press">성향 설문 하러 가기</Link>
        </div>
      )}

      {state === "ready" && results.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          아직 매칭 가능한 상대가 없어요. 더 많은 사용자가 성향을 등록하면 나타나요.
        </div>
      )}

      {state === "ready" && results.length > 0 && (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {results.map((m) => (
            <div key={m.userId} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div
                  style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    background: m.avatarUrl ? `center/cover url(${m.avatarUrl})` : m.avatarColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 700, fontSize: 18,
                  }}
                >
                  {!m.avatarUrl && m.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15.5 }}>{m.name}</strong>
                    <UserBadges verified={m.verified} tier={m.tier} tierLabel={m.tierLabel} />
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                    {[m.age ? `${m.age}세` : null, m.job].filter(Boolean).join(" · ") || "정보 없음"}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="display" style={{ fontSize: 22, fontWeight: 700, color: "var(--primary)" }}>{m.score}%</div>
                  <div style={{ fontSize: 11, color: "var(--text-2)" }}>궁합</div>
                </div>
              </div>

              {m.reasons.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "grid", gap: 4 }}>
                  {m.reasons.map((r, i) => (
                    <li key={i} style={{ fontSize: 13, color: "var(--text-2)" }}>· {r}</li>
                  ))}
                </ul>
              )}

              {m.keywords.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {m.keywords.slice(0, 4).map((k) => (
                    <span key={k} className="chip" style={{ fontSize: 11, background: "var(--bg-2)", color: "var(--primary)", border: "none" }}>{k}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
