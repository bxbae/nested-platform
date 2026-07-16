"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPreference, SURVEY } from "@/lib/api/preference";
import type { PreferenceView } from "@/lib/api/preference";

const AXIS_ICON: Record<string, string> = {
  noise: "🔊",
  cleanliness: "🧹",
  smoking: "🚬",
  pets: "🐾",
  visitors: "🚪",
  sleep: "🌙",
  sociability: "🗣️",
  sharedSpace: "🛋️",
  drinking: "🍺",
};

// Replaces the old quick-link buttons: shows the user's 9-question survey
// at a glance, or a CTA to fill it in if they haven't yet.
export function PreferenceSummary() {
  const [pref, setPref] = useState<PreferenceView | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getPreference()
      .then((p) => { if (!cancelled) setPref(p); })
      .catch(() => { if (!cancelled) setPref(null); });
    return () => { cancelled = true; };
  }, []);

  if (pref === undefined) return null; // loading — render nothing to avoid flash

  if (!pref || !pref.isCompleted) {
    return (
      <Link
        href="/me/preference"
        className="card hover-card"
        style={{
          marginTop: 20, padding: 20, display: "flex", alignItems: "center",
          gap: 12, justifyContent: "space-between",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }} aria-hidden="true">🧭</span>
          <span style={{ fontWeight: 600, fontSize: 14.5 }}>
            생활 성향을 등록하면 룸메이트 매칭이 시작돼요
          </span>
        </span>
        <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>등록하기 →</span>
      </Link>
    );
  }

  return (
    <div className="card" style={{ marginTop: 20, padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <strong style={{ fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden="true">🧭</span> 생활 성향
        </strong>
        <Link href="/me/preference" style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>
          수정 ✏️
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {SURVEY.map(({ axis, options }) => {
          const value = (pref as any)[axis] as string;
          const label = options.find((o) => o.value === value)?.label ?? value;
          return (
            <div key={axis} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 16 }} aria-hidden="true">{AXIS_ICON[axis]}</span>
              <span style={{ fontSize: 13.5, lineHeight: 1.4 }}>{label}</span>
            </div>
          );
        })}
      </div>

      {pref.keywords.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {pref.keywords.map((k) => (
            <span key={k} className="chip" style={{ fontSize: 12 }}>{k}</span>
          ))}
        </div>
      )}
    </div>
  );
}
