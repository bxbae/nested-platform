"use client";

// 숙소 상세 페이지 — 내 위치 기준 거리 표시
// browse(통근 검색)에서 쓰던 estimateCommute()를 그대로 재사용한다.
// 원래는 "직장 위치 ↔ 숙소" 거리를 구하던 함수인데, 좌표 두 개 사이
// 거리를 구하는 범용 함수라 "내 현재 위치 ↔ 숙소"에도 그대로 쓸 수 있다.

import { useEffect, useState } from "react";
import { estimateCommute } from "@/lib/commute";

interface DistanceFromMeProps {
  houseLat: number;
  houseLng: number;
}

export function DistanceFromMe({ houseLat, houseLng }: DistanceFromMeProps) {
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  // 위치 권한 거부, 위치 정보 없는 기기 등 실패 케이스를 구분해서 안내하기 위한 상태
  const [status, setStatus] = useState<"idle" | "loading" | "denied" | "unsupported">("idle");

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("idle");
      },
      () => {
        // 사용자가 위치 권한을 거부한 경우 등. 조용히 실패 처리 —
        // 이 기능은 "있으면 좋은" 부가 정보라 에러를 화면에 크게 띄우지 않는다.
        setStatus("denied");
      }
    );
  }, []);

  // 아직 위치를 못 가져왔으면(로딩 중/거부/미지원) 아무것도 표시하지 않는다.
  if (!myLocation) return null;

// 수정 — 도보/지하철 두 가지 추정치를 각각 계산해서 같이 보여줌
// estimateCommute()는 어떤 모드로 호출하든 km(직선거리)은 항상 정확히
// 반환하므로, 그 km 하나로 두 모드의 시간을 각각 계산한다.
// (아래 도보 13분/km, 지하철 22km/h 공식은 commute.ts의 estimateCommute와
// 동일한 기준을 그대로 따른 것 — 그 파일이 바뀌면 여기도 같이 확인 필요)
const raw = estimateCommute(houseLat, houseLng, myLocation.lat, myLocation.lng);
const km = raw.km;
const walkMinutes = Math.max(4, Math.round(km * 13));
const subwayMinutes = Math.round(10 + (km / 22) * 60);

// 수정 — 도보/지하철을 한 줄에 나란히 배치, 거리는 오른쪽 끝에 작게
return (
    <div
      className="card"
      style={{
        margin: "22px 0 0",
        padding: 16,
        display: "flex",
        alignItems: "center",
        gap: 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>🚶</span>
        <strong style={{ fontSize: 15 }}>도보 {walkMinutes}분</strong>
      </div>
  
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>🚇</span>
        <strong style={{ fontSize: 15 }}>지하철 {subwayMinutes}분</strong>
      </div>
  
      <div style={{ fontSize: 13, color: "var(--text-2)", marginLeft: "auto" }}>
        내 위치에서 약 {km}km
      </div>
    </div>
  );
}