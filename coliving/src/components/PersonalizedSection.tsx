"use client";

// 개인화 숙소 추천 섹션
//
// 왜 별도 클라이언트 컴포넌트로 분리했는가:
// 로그인 토큰이 브라우저의 localStorage에만 저장되어 있는데(auth-store.ts 참고),
// 홈 화면(page.tsx)은 서버 컴포넌트라 서버에서 실행되는 코드는 localStorage에
// 접근할 수 없다. 그래서 "로그인 토큰이 필요한 이 섹션만" 브라우저에서 직접
// 실행되는 클라이언트 컴포넌트로 분리하고, useEffect로 데이터를 가져온다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPersonalizedRooms } from "@/lib/api/rooms";
import { Thumbnail } from "@/components/Thumbnail";
import { getAccommodationLabel, getPriceUnitLabel } from "@/lib/types";
import { wonShort } from "@/lib/format";
import type { House } from "@/lib/types";

function SectionHead({
  eyebrow,
  title,
  href,
  hrefLabel,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
      <div>
        <div style={{ color: "var(--primary)", fontWeight: 600, fontSize: 13.5 }}>{eyebrow}</div>
        <h2 className="display" style={{ fontSize: "clamp(24px, 3vw, 32px)", marginTop: 6 }}>{title}</h2>
      </div>
      {href && (
        <Link href={href} style={{ color: "var(--secondary)", fontSize: 14, fontWeight: 600 }}>
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}

export function PersonalizedSection() {
  const [rooms, setRooms] = useState<(House & { personalizedReason: string | null })[]>([]);
  const [userName, setUserName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getPersonalizedRooms()
      .then((res) => {
        setRooms(res.rooms);
        setUserName(res.userName);
      })
      .catch(() => {
        // 비로그인이거나 API 실패 시 조용히 빈 상태로 둠 (섹션 자체를 숨김)
      })
      .finally(() => setLoaded(true));
  }, []);

  // 아직 로딩 중이거나, 개인화할 데이터가 없으면 아무것도 렌더링하지 않음
  // (부모인 page.tsx가 이 경우 기존 "이번 주 추천하는 집" 섹션을 대신 보여줌)
  if (!loaded || rooms.length === 0) return null;

  return (
    <section className="section" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div className="wrap">
        <SectionHead
          eyebrow="개인화 추천"
          title={userName ? `${userName}님을 위한 숙소 추천!` : "당신을 위한 추천"}
          href="/search"
          hrefLabel="더 둘러보기"
        />
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
                    {getAccommodationLabel(h)}
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
                  <span style={{ color: "var(--text-2)", fontSize: 13 }}> / 월 · {getPriceUnitLabel(h.rentalUnit)}</span>
                </div>
                {h.personalizedReason && (
                  <div style={{ fontSize: 12.5, color: "var(--primary)", marginTop: 6 }}>
                    {h.personalizedReason}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}