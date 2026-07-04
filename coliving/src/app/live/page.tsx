"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api/config";

// 백엔드 /rooms API 응답의 숙소 한 건 형태 (필요한 필드만)
interface ApiRoom {
  id: string;
  name: string;
  region: string;
  roomType: string;
  monthlyRent: number;
  deposit: number;
  cleaningFee: number;
  maintenanceFee: number;
  published: boolean;
}

export default function LivePage() {
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // 프론트(3000) → 백엔드(4000) 실제 호출
    fetch(`${API_BASE_URL}/rooms`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setRooms(data.items ?? []);
        setStatus("ok");
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setStatus("error");
      });
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        🔴 Live — 백엔드 DB 실시간 연결
      </h1>
      <p style={{ color: "#717171", marginBottom: 24 }}>
        이 화면의 데이터는 <b>localhost:4000</b> 백엔드가 <b>PostgreSQL</b>에서
        가져온 실제 숙소입니다.
      </p>

      {status === "loading" && <p>불러오는 중…</p>}

      {status === "error" && (
        <div
          style={{
            padding: 16,
            background: "#ffeff0",
            borderRadius: 12,
            color: "#e0484d",
          }}
        >
          <strong>연결 실패:</strong> {errorMsg}
          <div style={{ fontSize: 13, marginTop: 8, color: "#717171" }}>
            백엔드(4000)가 켜져 있는지, CORS가 허용됐는지 확인하세요.
          </div>
        </div>
      )}

      {status === "ok" && (
        <>
          <p style={{ marginBottom: 16, fontWeight: 600 }}>
            ✅ 연결 성공 · DB에서 {rooms.length}개 숙소를 가져왔습니다
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            {rooms.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid #ebebeb",
                  borderRadius: 16,
                  padding: 20,
                  boxShadow: "0 1px 2px rgba(0,0,0,.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 17 }}>{r.name}</strong>
                    <div
                      style={{ color: "#717171", fontSize: 14, marginTop: 2 }}
                    >
                      {r.region} · {r.roomType}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      ₩{r.monthlyRent.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: "#717171" }}>/ 월</div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    marginTop: 12,
                    fontSize: 13,
                    color: "#717171",
                  }}
                >
                  <span>보증금 ₩{r.deposit.toLocaleString()}</span>
                  <span>청소비 ₩{r.cleaningFee.toLocaleString()}</span>
                  <span>관리비 ₩{r.maintenanceFee.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 8 }}>
                  id: {r.id}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
