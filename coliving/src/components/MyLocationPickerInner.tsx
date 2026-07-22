"use client";

// 사용자가 지도를 클릭해서 자기 위치를 직접 지정하는 지도
// LocationMapInner.tsx와는 별개 컴포넌트입니다:
//   - LocationMapInner: 숙소 "위치"를 흐릿한 원으로 보여주기만 하는 용도 (읽기 전용)
//   - 이 파일(MyLocationPickerInner): 사용자가 지도를 클릭해서 "내 위치"를 직접
//     찍을 수 있게 하는 용도 (클릭 이벤트 필요)

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState } from "react";

// Leaflet 기본 마커 아이콘은 번들링 환경에서 경로가 깨지는 경우가 많아 CDN으로 직접 지정
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// react-leaflet의 지도 이벤트는 <MapContainer> 안의 자식 컴포넌트에서만 구독 가능.
// 클릭 감지 전담 컴포넌트, 화면엔 아무것도 안 그리므로 return null.
function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MyLocationPickerInner({
  initialLat,
  initialLng,
  onPick,
}: {
  initialLat: number;
  initialLng: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  return (
    <MapContainer
      center={[initialLat, initialLng]}
      zoom={13}
      scrollWheelZoom={true}
      style={{ width: "100%", height: 260 }}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      <ClickCapture
        onPick={(lat, lng) => {
          setPicked({ lat, lng });
          onPick(lat, lng);
        }}
      />
      {picked && <Marker position={[picked.lat, picked.lng]} icon={markerIcon} />}
    </MapContainer>
  );
}
