"use client";

import { useState } from "react";
import type { MatchResult, MatchPreferences } from "@/lib/types";

const allInterests = [
  "design", "coding", "art", "music", "cooking", "coffee",
  "hiking", "climbing", "books", "film", "travel", "games", "sports", "wine",
];

export default function Match() {
  const [pref, setPref] = useState<MatchPreferences>({
    sleepSchedule: "flexible",
    cleanliness: 4,
    social: 3,
    interests: [],
    smoker: false,
    pets: false,
  });
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleInterest(i: string) {
    setPref((p) => ({
      ...p,
      interests: p.interests.includes(i)
        ? p.interests.filter((x) => x !== i)
        : [...p.interests, i],
    }));
  }

  async function run() {
    setLoading(true);
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pref),
    });
    const data = await res.json();
    setResults(data.results);
    setLoading(false);
  }

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <span className="eyebrow">Roommate match</span>
      <h1 className="display" style={{ fontSize: 40, marginTop: 8 }}>
        Who you&apos;d actually click with
      </h1>
      <p style={{ color: "var(--text-2)", maxWidth: 560, marginTop: 8 }}>
        Tell us how you live. We&apos;ll score everyone in the house on rhythm,
        tidiness, energy, and shared interests — and show our reasoning.
      </p>

      <div className="match-layout" style={{ marginTop: 30 }}>
        {/* Preferences form */}
        <div className="card map-sticky" style={{ padding: 24 }}>
          <strong style={{ fontSize: 16 }}>Your preferences</strong>

          <div className="field" style={{ marginTop: 18 }}>
            <label>Sleep schedule</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["early", "flexible", "night"] as const).map((s) => (
                <button
                  key={s}
                  className="chip"
                  data-active={pref.sleepSchedule === s}
                  onClick={() => setPref((p) => ({ ...p, sleepSchedule: s }))}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {s === "early" ? "Early bird" : s === "night" ? "Night owl" : "Flexible"}
                </button>
              ))}
            </div>
          </div>

          <Slider
            label="Tidiness"
            hint={["relaxed", "spotless"]}
            value={pref.cleanliness}
            onChange={(v) => setPref((p) => ({ ...p, cleanliness: v }))}
          />
          <Slider
            label="Social energy"
            hint={["keep to myself", "always hosting"]}
            value={pref.social}
            onChange={(v) => setPref((p) => ({ ...p, social: v }))}
          />

          <div className="field" style={{ marginTop: 18 }}>
            <label>Interests</label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {allInterests.map((i) => (
                <button
                  key={i}
                  className="chip"
                  data-active={pref.interests.includes(i)}
                  onClick={() => toggleInterest(i)}
                  style={{ fontSize: 12.5 }}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 18, marginTop: 18 }}>
            <Toggle
              label="I smoke"
              value={pref.smoker}
              onChange={(v) => setPref((p) => ({ ...p, smoker: v }))}
            />
            <Toggle
              label="I have a pet"
              value={pref.pets}
              onChange={(v) => setPref((p) => ({ ...p, pets: v }))}
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 22 }}
            onClick={run}
            disabled={loading}
          >
            {loading ? "Scoring…" : "Find my matches"}
          </button>
        </div>

        {/* Results */}
        <div>
          {!results && (
            <div
              className="card"
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-2)",
                border: "1px dashed var(--border)",
                background: "transparent",
              }}
            >
              <svg width="60" height="54" viewBox="0 0 40 40" style={{ margin: "0 auto 14px" }}>
                <circle cx="15" cy="20" r="11" stroke="var(--secondary)" strokeWidth="1.6" fill="none" />
                <circle cx="25" cy="20" r="11" stroke="var(--primary)" strokeWidth="1.6" fill="none" />
              </svg>
              Set your preferences and run the match to see who fits.
            </div>
          )}
          {results && (
            <div style={{ display: "grid", gap: 14 }}>
              {results.map((m, i) => (
                <MatchCard key={m.resident.id} match={m} rank={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match, rank }: { match: MatchResult; rank: number }) {
  const { resident, score, reasons } = match;
  const tone = score >= 75 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--text-2)";
  return (
    <div className="card" style={{ padding: 20, display: "flex", gap: 18 }}>
      {/* Score ring */}
      <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r="29" fill="none" stroke="var(--border)" strokeWidth="6" />
          <circle
            cx="34"
            cy="34"
            r="29"
            fill="none"
            stroke={tone}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 182} 182`}
            transform="rotate(-90 34 34)"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 17,
            color: tone,
          }}
        >
          {score}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <strong style={{ fontSize: 16.5 }}>
            {resident.name}
            {rank === 0 && (
              <span className="chip" style={{ marginLeft: 8, background: "var(--secondary)", color: "#fff", fontSize: 11 }}>
                Top match
              </span>
            )}
          </strong>
          <span style={{ fontSize: 13, color: "var(--text-2)" }}>
            {resident.age} · {resident.occupation}
          </span>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 4 }}>{resident.bio}</p>
        <ul style={{ listStyle: "none", marginTop: 12, display: "grid", gap: 5 }}>
          {reasons.slice(0, 4).map((r, idx) => (
            <li key={idx} style={{ fontSize: 13.5, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: tone, marginTop: 1 }}>◗</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: [string, string];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field" style={{ marginTop: 18 }}>
      <label>{label}</label>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--text-2)" }}>
        <span>{hint[0]}</span>
        <span>{hint[1]}</span>
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14 }}
    >
      <span
        style={{
          width: 40,
          height: 23,
          borderRadius: 99,
          background: value ? "var(--secondary)" : "var(--border)",
          position: "relative",
          transition: "background .15s ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 19 : 2,
            width: 19,
            height: 19,
            borderRadius: 99,
            background: "#fff",
            transition: "left .15s ease",
            boxShadow: "var(--shadow-sm)",
          }}
        />
      </span>
      {label}
    </button>
  );
}
