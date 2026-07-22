"use client";

import { useState, useEffect } from "react";
import type { SearchParams, RoomType, GenderPolicy } from "@/lib/types";
import { ROOM_TYPE_LABELS, GENDER_LABELS } from "@/lib/types";
import { won } from "@/lib/format";
import { RENT_MIN, RENT_MAX, DEFAULT_FILTERS } from "../schema";
import { DISTRICT_OPTIONS } from "@/lib/seoul";

const ROOM_TYPES: RoomType[] = ["one_room", "share_room", "whole_house", "apartment"];
const GENDERS: GenderPolicy[] = ["any", "female_only", "male_only"];
const ROOM_TYPE_DESCRIPTIONS: Record<RoomType, string> = { one_room: "개인 공간 중심", share_room: "침실 또는 공간 공유", whole_house: "집 전체 단독 사용", apartment: "아파트형 주거" };

export function FilterSheet({
  open,
  initial,
  onApply,
  onClose,
}: {
  open: boolean;
  initial: SearchParams;
  onApply: (f: SearchParams) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SearchParams>(initial);

  // sync when reopened with fresh initial
  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  if (!open) return null;

  const set = (patch: Partial<SearchParams>) => setDraft((d) => ({ ...d, ...patch }));

  const toggleRoomType = (rt: RoomType) => {
    const cur = draft.roomTypes ?? [];
    set({ roomTypes: cur.includes(rt) ? cur.filter((x) => x !== rt) : [...cur, rt] });
  };

  return (
    <>
      {/* scrim */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 100,
          animation: "fadeIn .2s ease",
        }}
        aria-hidden="true"
      />
      {/* drawer */}
      <div
        role="dialog"
        aria-label="검색 필터"
        aria-modal="true"
        className="filter-drawer"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            position: "sticky",
            top: 0,
            background: "var(--bg)",
            zIndex: 1,
          }}
        >
          <strong style={{ fontSize: 17 }}>필터</strong>
          <button
            onClick={onClose}
            className="press"
            aria-label="닫기"
            style={{ fontSize: 22, lineHeight: 1, color: "var(--text-2)" }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 26 }}>
          {/* District */}
          <Section title="지역(구)">
            <p style={{ fontSize: 12.5, color: "var(--text-2)", marginBottom: 12 }}>
              서울은 구 단위로 먼저 선택하고, 검색창에서 역·동 이름을 추가할 수 있습니다.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="chip" data-active={!draft.district} onClick={() => set({ district: "", region: "" })}>전체</button>
              {DISTRICT_OPTIONS.map((item) => (
                <button key={item.value} className="chip" data-active={draft.district === item.value} onClick={() => set({ district: draft.district === item.value ? "" : item.value, region: "" })}>
                  {item.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="안심 조건">
            <ToggleRow label="호스트 확인 숙소만" value={!!draft.verified} onChange={(v) => set({ verified: v })} />
          </Section>

          {/* Room type */}
          <Section title="주거 형태">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {ROOM_TYPES.map((rt) => {
                const on = (draft.roomTypes ?? []).includes(rt);
                return (
                  <button
                    key={rt}
                    onClick={() => toggleRoomType(rt)}
                    className="press"
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--r-sm)",
                      border: on ? "1.5px solid var(--text)" : "1px solid var(--border)",
                      background: on ? "var(--text)" : "#fff",
                      color: on ? "var(--bg)" : "var(--text)",
                      fontWeight: 600,
                      fontSize: 14,
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "block" }}>{ROOM_TYPE_LABELS[rt]}</span>
                    <span style={{ display: "block", marginTop: 3, fontSize: 11.5, fontWeight: 450, opacity: 0.72 }}>{ROOM_TYPE_DESCRIPTIONS[rt]}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Price */}
          <Section title="가격 (월세)">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
              <span>{won(draft.minRent ?? RENT_MIN)}</span>
              <span>{won(draft.maxRent ?? RENT_MAX)}{(draft.maxRent ?? RENT_MAX) >= RENT_MAX ? "+" : ""}</span>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-2)" }}>최소</label>
              <input
                type="range"
                min={RENT_MIN}
                max={RENT_MAX}
                step={10000}
                value={draft.minRent ?? RENT_MIN}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  set({ minRent: Math.min(v, (draft.maxRent ?? RENT_MAX)) });
                }}
              />
              <label style={{ fontSize: 12, color: "var(--text-2)" }}>최대</label>
              <input
                type="range"
                min={RENT_MIN}
                max={RENT_MAX}
                step={10000}
                value={draft.maxRent ?? RENT_MAX}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  set({ maxRent: Math.max(v, (draft.minRent ?? RENT_MIN)) });
                }}
              />
            </div>
          </Section>

          {/* Available from */}
          <Section title="입주 가능일">
            <input
              type="date"
              value={draft.availableFrom ?? ""}
              onChange={(e) => set({ availableFrom: e.target.value })}
              style={{
                padding: "11px 14px",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                width: "100%",
              }}
            />
            <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6 }}>
              선택한 날짜에 입주 가능한 숙소만 표시됩니다.
            </p>
          </Section>

          {/* Gender */}
          {/* 방 개수 — 미입력 매물은 조건을 만족하지 않아 제외된다 */}
          <Section title="방 개수">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="chip"
                  data-active={draft.minBedrooms === n}
                  onClick={() =>
                    set({ minBedrooms: draft.minBedrooms === n ? undefined : n })
                  }
                >
                  {n}개 이상
                </button>
              ))}
            </div>
          </Section>

          {/* 인원수 — 독채는 정원이 없어 이 필터를 걸면 자연히 제외된다 */}
          <Section title="함께 지낼 인원">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="chip"
                  data-active={draft.minCapacity === n}
                  onClick={() =>
                    set({ minCapacity: draft.minCapacity === n ? undefined : n })
                  }
                >
                  {n}명 이상
                </button>
              ))}
            </div>
          </Section>

          <Section title="성별">
            <div style={{ display: "flex", gap: 8 }}>
              {GENDERS.map((g) => (
                <button
                  key={g}
                  className="chip"
                  data-active={(draft.gender ?? "any") === g}
                  onClick={() => set({ gender: g })}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {GENDER_LABELS[g]}
                </button>
              ))}
            </div>
          </Section>

          {/* Toggles */}
          <Section title="옵션">
            <div style={{ display: "grid", gap: 4 }}>
              <ToggleRow
                label="반려동물 가능"
                value={!!draft.pets}
                onChange={(v) => set({ pets: v })}
              />
              <ToggleRow
                label="흡연 가능"
                value={!!draft.smoking}
                onChange={(v) => set({ smoking: v })}
              />
              <ToggleRow
                label="주차 가능"
                value={!!draft.parking}
                onChange={(v) => set({ parking: v })}
              />
            </div>
          </Section>
        </div>

        {/* footer actions */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            display: "flex",
            gap: 12,
            padding: "16px 22px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg)",
          }}
        >
          <button
            className="btn btn-ghost press"
            style={{ flex: "0 0 auto" }}
            onClick={() => setDraft({ ...DEFAULT_FILTERS, q: draft.q, sort: draft.sort })}
          >
            초기화
          </button>
          <button
            className="btn btn-primary press"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => onApply(draft)}
          >
            적용하기
          </button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function ToggleRow({
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
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        fontSize: 15,
      }}
      role="switch"
      aria-checked={value}
    >
      <span>{label}</span>
      <span
        style={{
          width: 44,
          height: 26,
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
            left: value ? 20 : 2,
            width: 22,
            height: 22,
            borderRadius: 99,
            background: "#fff",
            transition: "left .18s cubic-bezier(.2,.8,.3,1)",
            boxShadow: "var(--shadow-sm)",
          }}
        />
      </span>
    </button>
  );
}
