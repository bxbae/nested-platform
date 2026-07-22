"use client";

// Leaflet은 브라우저의 window 객체가 필요해서, 서버에서 미리 그리면(SSR) 에러가 남.
// next/dynamic의 { ssr: false }로 "브라우저 도착 후에만 불러와라" 지정.
// 기존 LocationMap.tsx와 동일한 패턴.
import dynamic from "next/dynamic";

const MyLocationPickerInner = dynamic(() => import("@/components/MyLocationPickerInner"), {
  ssr: false,
  loading: () => <div style={{ width: "100%", height: 260, background: "var(--secondary-soft)" }} />,
});

export function MyLocationPicker({
  initialLat,
  initialLng,
  onPick,
}: {
  initialLat: number;
  initialLng: number;
  onPick: (lat: number, lng: number) => void;
}) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <MyLocationPickerInner initialLat={initialLat} initialLng={initialLng} onPick={onPick} />
      <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--text-2)" }}>
        지도를 클릭해서 내 위치를 지정해보세요
      </div>
    </div>
  );
}