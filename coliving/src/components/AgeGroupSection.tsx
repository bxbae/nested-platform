"use client";

// 연령대별 인기 숙소 섹션
//
// PersonalizedSection 과 같은 이유로 클라이언트 컴포넌트다 — 로그인 토큰이
// localStorage 에만 있어서 서버에서는 이 데이터를 가져올 수 없다.
// 개인화 추천이 "내 찜 기반"이라면 이쪽은 "또래가 고른 것" 관점이라,
// 찜이 하나도 없는 신규 사용자에게도 보여줄 거리가 생긴다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { getAgeGroupRooms } from "@/lib/api/rooms";
import { Thumbnail } from "@/components/Thumbnail";
import { ROOM_TYPE_LABELS } from "@/lib/types";
import { wonShort } from "@/lib/format";
import type { House } from "@/lib/types";

export function AgeGroupSection() {
  const [rooms, setRooms] = useState<House[]>([]);
  const [ageGroup, setAgeGroup] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAgeGroupRooms()
      .then((res) => {
        setRooms(res.rooms);
        setAgeGroup(res.ageGroup);
      })
      .catch(() => {
        // 비로그인이거나 생년월일 미입력이면 조용히 숨긴다.
      })
      .finally(() => setLoaded(true));
  }, []);

  // 생년월일이 없으면 ageGroup 이 null 로 와서 문구를 만들 수 없다.
  if (!loaded || rooms.length === 0 || ageGroup == null) return null;

  return (
    <section className="section" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div className="wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <div style={{ color: "var(--primary)", fontWeight: 600, fontSize: 13.5 }}>연령대 추천</div>
            <h2 className="display" style={{ fontSize: "clamp(24px, 3vw, 32px)", marginTop: 6 }}>
              {ageGroup}대에게 인기 있는 숙소
            </h2>
          </div>
          <Link href="/search" style={{ color: "var(--secondary)", fontSize: 14, fontWeight: 600 }}>
            더 둘러보기 →
          </Link>
        </div>
        <div className="reco-grid">
          {rooms.map((h, i) => (
            <Link
              key={h.id}
              href={`/homes/${h.id}`}
              className="card hover-card reveal"
              style={{ overflow: "hidden", animationDelay: `${i * 0.07}s` }}
            >
              <Thumbnail src={h.photo} color={h.color} height={170}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: 12, height: "100%" }}>
                  <span className="chip glass" style={{ border: "none", color: "var(--text)", fontWeight: 600 }}>
                    {ROOM_TYPE_LABELS[h.roomType]}
                  </span>
                  <span className="chip glass" style={{ border: "none", color: "var(--text)", fontSize: 12 }}>
                    ★ {h.rating}
                  </span>
                </div>
              </Thumbnail>
              <div style={{ padding: 15 }}>
                <strong style={{ fontSize: 15 }}>{h.name.trim()}</strong>
                <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 2 }}>
                  {h.region} · 리뷰 {h.reviews}
                </div>
                <div style={{ marginTop: 10, fontSize: 15 }}>
                  <strong>{wonShort(h.monthlyRent)}</strong>
                  <span style={{ color: "var(--text-2)", fontSize: 13 }}> / 월</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--primary)", marginTop: 6 }}>
                  {ageGroup}대가 많이 선택한 숙소예요
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
