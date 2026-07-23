"use client";

// 숙소 상세 페이지 — 내 위치 기준 거리 표시
// 도보/지하철은 예전엔 직접 계산했지만, 이제 ODsay API 기반 실시간
// 대중교통 정보(버스/지하철/지하철+버스)까지 한 번에 받아오는 방식으로 교체.
// 지도에서 직접 위치 지정하는 기능은 그대로 유지.
import { useEffect, useState } from "react";
import { getTransitRoutes, type TransitResult } from "@/lib/api/transit";
import { MyLocationPicker } from "@/components/MyLocationPicker";

interface DistanceFromMeProps {
  houseLat: number;
  houseLng: number;
}

interface TabItem {
  key: string;
  label: string;
  icon: string;
  minutes: number;
  note?: string;
}

const MODE_LABEL: Record<string, { label: string; icon: string }> = {
  walk: { label: "도보", icon: "🚶" },
  subway: { label: "지하철", icon: "🚇" },
  bus: { label: "버스", icon: "🚌" },
  subway_bus: { label: "지하철+버스", icon: "🚇🚌" },
  car: { label: "자동차", icon: "🚗" },
};

export function DistanceFromMe({ houseLat, houseLng }: DistanceFromMeProps) {
  const [autoLocation, setAutoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [manualLocation, setManualLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [routes, setRoutes] = useState<TransitResult | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string>("walk");

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setAutoLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        /* 거부되면 조용히 무시 — 지도로 직접 지정하는 버튼이 대안이 됨 */
      }
    );
  }, []);

  const myLocation = manualLocation ?? autoLocation;

  useEffect(() => {
    if (!myLocation) return;
    setLoadingRoutes(true);
    getTransitRoutes(myLocation.lat, myLocation.lng, houseLat, houseLng)
      .then((res) => {
        setRoutes(res);
        setSelectedTab("walk");
      })
      .catch(() => setRoutes(null))
      .finally(() => setLoadingRoutes(false));
  }, [myLocation?.lat, myLocation?.lng, houseLat, houseLng]);

  const tabs: TabItem[] = routes
    ? [
        { key: "walk", ...MODE_LABEL.walk, minutes: routes.walk.minutes },
        ...routes.transit.map((t) => ({
          key: t.mode,
          ...MODE_LABEL[t.mode],
          minutes: t.minutes,
          // ODsay API 포기 후 예상치 계산으로 전환 — "예상"임을 명확히 표시
          note: t.transferCount ? `환승 ${t.transferCount}회` : undefined,
        })),
        { key: "car", ...MODE_LABEL.car, minutes: routes.car.minutes},
      ]
    : [];

  const active = tabs.find((t) => t.key === selectedTab) ?? tabs[0];

  return (
    <div style={{ margin: "22px 0 0" }}>
      {loadingRoutes && (
        <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--text-2)" }}>
          이동 시간 계산 중...
        </div>
      )}

      {!loadingRoutes && tabs.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setSelectedTab(t.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: "1px solid var(--border)",
                  background: t.key === selectedTab ? "var(--primary)" : "transparent",
                  color: t.key === selectedTab ? "#fff" : "var(--text)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {active && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{active.icon}</span>
              <div>
                <strong style={{ fontSize: 16 }}>
                  {active.label} {active.minutes}분
                </strong>
                {active.note && (
                  <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>{active.note}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setShowPicker((v) => !v)}
        style={{
          marginTop: 8,
          fontSize: 13,
          color: "var(--primary)",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        {showPicker ? "지도 닫기" : "📍 내 위치 직접 지정하기"}
      </button>

      {showPicker && (
        <div style={{ marginTop: 10 }}>
          <MyLocationPicker
            initialLat={houseLat}
            initialLng={houseLng}
            onPick={(lat, lng) => setManualLocation({ lat, lng })}
          />
        </div>
      )}
    </div>
  );
}