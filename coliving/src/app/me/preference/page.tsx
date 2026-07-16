"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/api/useAuth";
import {
  SURVEY,
  getPreference,
  savePreference,
  type Preference,
  type PreferenceAxis,
  type PreferenceView,
} from "@/lib/api/preference";

// 생활 성향 설문 (스토리보드 1-2 / 08).
// A single stepped survey: nine 3-choice questions with a progress bar, then a
// free-text step, then a result card. Reused for both first-time onboarding
// and later edits — completing it sets isCompleted, which unlocks /match.
export default function PreferencePage() {
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<PreferenceView | null>(null);
  const [editing, setEditing] = useState(false);

  // step 0..8 = questions, 9 = free text, then submit.
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Preference>>({});
  const [intro, setIntro] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const p = await getPreference();
        if (!alive) return;
        setExisting(p);
      } catch {
        /* not fatal: treat as not-yet-completed */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function pick(axis: PreferenceAxis, value: string) {
    setAnswers((a) => ({ ...a, [axis]: value }));
    // auto-advance to keep the flow quick
    setTimeout(() => setStep((s) => Math.min(s + 1, SURVEY.length)), 120);
  }

  async function submit() {
    if (saving) return;
    // all nine axes must be answered
    const missing = SURVEY.find((q) => !answers[q.axis]);
    if (missing) {
      setError("모든 항목에 응답해주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await savePreference({
        ...(answers as Preference),
        intro: intro.trim() || undefined,
      });
      setExisting(saved);
      setEditing(false);
      setStep(0);
      setAnswers({});
      setIntro("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    if (existing) {
      setAnswers({
        noise: existing.noise,
        cleanliness: existing.cleanliness,
        smoking: existing.smoking,
        pets: existing.pets,
        visitors: existing.visitors,
        sleep: existing.sleep,
        sociability: existing.sociability,
        sharedSpace: existing.sharedSpace,
        drinking: existing.drinking,
      });
      setIntro(existing.intro ?? "");
    }
    setStep(0);
    setEditing(true);
  }

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: 620 }}>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>생활 성향</h1>
        <p style={{ color: "var(--text-2)" }}>로그인이 필요해요.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 620 }}>
        <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>생활 성향</h1>
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      </div>
    );
  }

  // ── Result view: completed and not editing ──
  if (existing?.isCompleted && !editing) {
    return (
      <div style={{ maxWidth: 620 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 className="display" style={{ fontSize: 30 }}>나의 생활 성향</h1>
          <button onClick={startEdit} style={btnGhost}>수정</button>
        </div>

        <div style={card}>
          {SURVEY.map((q) => {
            const val = existing[q.axis];
            const opt = q.options.find((o) => o.value === val);
            return (
              <div key={q.axis} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-2)", fontSize: 14 }}>{q.question}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{opt?.label ?? "—"}</span>
              </div>
            );
          })}
        </div>

        {existing.keywords.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {existing.keywords.map((k) => (
              <span key={k} style={chip}>{k}</span>
            ))}
          </div>
        )}

        {existing.intro && (
          <p style={{ marginTop: 16, color: "var(--text-2)", fontSize: 14, lineHeight: 1.6 }}>{existing.intro}</p>
        )}
      </div>
    );
  }

  // ── Survey view: stepping through questions ──
  const isTextStep = step >= SURVEY.length;
  const progress = Math.round((step / (SURVEY.length + 1)) * 100);

  return (
    <div style={{ maxWidth: 620 }}>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 8 }}>
        {editing ? "생활 성향 수정" : "생활 성향 설문"}
      </h1>
      <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 20 }}>
        룸메이트 매칭에 사용돼요. 솔직하게 답할수록 잘 맞는 상대를 찾을 수 있어요.
      </p>

      {/* progress bar */}
      <div style={{ height: 6, background: "var(--bg-2)", borderRadius: 99, marginBottom: 24, overflow: "hidden" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "var(--primary)", transition: "width .2s" }} />
      </div>

      {!isTextStep ? (
        <div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 8 }}>
            {step + 1} / {SURVEY.length + 1}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>{SURVEY[step].question}</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {SURVEY[step].options.map((o) => {
              const selected = answers[SURVEY[step].axis] === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => pick(SURVEY[step].axis, o.value)}
                  style={{
                    ...optionBtn,
                    borderColor: selected ? "var(--primary)" : "var(--border)",
                    background: selected ? "var(--bg-2)" : "var(--surface)",
                    fontWeight: selected ? 600 : 450,
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 8 }}>
            {SURVEY.length + 1} / {SURVEY.length + 1}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>자기소개 (선택)</h2>
          <p style={{ color: "var(--text-2)", fontSize: 14, marginBottom: 12 }}>
            자유롭게 적어주세요. 키워드를 자동으로 뽑아드려요.
          </p>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="예: 조용한 환경을 좋아하고 깔끔하게 지내는 편이에요."
            style={{
              width: "100%", padding: 12, borderRadius: "var(--r-sm)",
              border: "1px solid var(--border)", background: "var(--surface)",
              color: "var(--text)", fontSize: 14, resize: "vertical",
            }}
          />
        </div>
      )}

      {error && <p style={{ color: "#e5484d", fontSize: 14, marginTop: 16 }}>{error}</p>}

      {/* nav buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} style={btnGhost}>이전</button>
        )}
        {isTextStep ? (
          <button onClick={submit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중…" : "완료"}
          </button>
        ) : (
          answers[SURVEY[step].axis] && (
            <button onClick={() => setStep((s) => s + 1)} style={btnPrimary}>다음</button>
          )
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "var(--r-sm)", padding: "4px 16px",
};
const chip: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 99, background: "var(--bg-2)",
  color: "var(--primary)", fontSize: 13, fontWeight: 500,
};
const optionBtn: React.CSSProperties = {
  padding: "14px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 15, textAlign: "left",
  cursor: "pointer", transition: "border-color .15s, background .15s",
};
const btnPrimary: React.CSSProperties = {
  padding: "10px 20px", borderRadius: "var(--r-sm)", border: "none",
  background: "var(--primary)", color: "#fff", fontSize: 14.5, fontWeight: 600, cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  padding: "10px 20px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)",
  background: "transparent", color: "var(--text)", fontSize: 14.5, fontWeight: 500, cursor: "pointer",
};
