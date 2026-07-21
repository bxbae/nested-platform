"use client";

import { useEffect, useState } from "react";
import { won } from "@/lib/format";
import { getHostSettlements, type SettlementSummary } from "@/lib/api/host";

export default function HostSettlements() {
  const [data, setData] = useState<SettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHostSettlements()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const rows = data?.rows ?? [];

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>정산 내역</h1>
      <p style={{ color: "var(--text-2)", marginBottom: 24 }}>
        예약별 정산 예정액과 수수료, 실수령액을 확인하세요. (플랫폼 수수료 5%)
        <br />
        <span style={{ fontSize: 12.5 }}>
          보증금은 퇴실 시 반환되는 금액으로 수익·정산액에 포함되지 않습니다.
        </span>
      </p>

      {/* summary cards */}
      <div className="stat-row" style={{ marginBottom: 12 }}>
        <SummaryCard label="총 거래액" value={loading ? "…" : won(data?.totalGross ?? 0)} />
        <SummaryCard label="플랫폼 수수료" value={loading ? "…" : won(data?.totalCommission ?? 0)} />
        <SummaryCard label="정산 예정액" value={loading ? "…" : won(data?.scheduledNet ?? 0)} accent />
        <SummaryCard label="지급 완료" value={loading ? "…" : won(data?.paidNet ?? 0)} muted />
      </div>

      {/* occupancy / deposits held — current stays only */}
      <div className="stat-row" style={{ marginBottom: 24 }}>
        <SummaryCard label="현재 입주 인원" value={loading ? "…" : `${data?.totalOccupants ?? 0}명`} />
        <SummaryCard label="보유 보증금" value={loading ? "…" : won(data?.totalDeposit ?? 0)} muted />
        <SummaryCard label="진행 중 계약" value={loading ? "…" : `${rows.filter((r) => r.status === "SCHEDULED").length}건`} />
        <SummaryCard label="종료된 계약" value={loading ? "…" : `${rows.filter((r) => r.status === "PAID").length}건`} muted />
      </div>

      {loading && <div style={{ color: "var(--text-2)" }}>불러오는 중…</div>}

      {!loading && rows.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-2)", border: "1px dashed var(--border)", background: "transparent" }}>
          정산할 예약이 아직 없습니다. 예약이 확정되면 여기에 표시됩니다.
        </div>
      )}

      {rows.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ background: "var(--surface-2, #f7f7f7)", textAlign: "left" }}>
                  <Th>숙소</Th>
                  <Th>입주자</Th>
                  <Th center>인원</Th>
                  <Th>계약 기간</Th>
                  <Th right>월세</Th>
                  <Th right>보증금</Th>
                  <Th right>거래액</Th>
                  <Th right>수수료</Th>
                  <Th right>실수령액</Th>
                  <Th center>상태</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.reservationId} style={{ borderTop: "1px solid var(--border)" }}>
                    <Td>{r.roomName}</Td>
                    <Td>{r.guestName}</Td>
                    <Td center>{r.occupants}명</Td>
                    <Td>
                      {r.checkIn} ~ {r.checkOut}
                      <span style={{ color: "var(--text-2)" }}> ({r.months}개월)</span>
                    </Td>
                    <Td right>{won(r.monthlyRent)}</Td>
                    <Td right muted>{won(r.deposit)}</Td>
                    <Td right>{won(r.gross)}</Td>
                    <Td right muted>−{won(r.commission)}</Td>
                    <Td right strong>{won(r.net)}</Td>
                    <Td center>
                      <span
                        className="chip"
                        style={{
                          fontSize: 11,
                          background: r.status === "PAID" ? "var(--text-2)" : "var(--secondary)",
                          color: "#fff",
                          border: "none",
                        }}
                      >
                        {r.status === "PAID" ? "지급 완료" : "정산 예정"}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</div>
      <div
        className="display"
        style={{
          fontSize: 22,
          fontWeight: 700,
          marginTop: 4,
          color: accent ? "var(--primary)" : muted ? "var(--text-2)" : "var(--text)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) {
  return (
    <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-2)", textAlign: right ? "right" : center ? "center" : "left", whiteSpace: "nowrap" }}>
      {children}
    </th>
  );
}

function Td({ children, right, center, strong, muted }: { children: React.ReactNode; right?: boolean; center?: boolean; strong?: boolean; muted?: boolean }) {
  return (
    <td
      style={{
        padding: "12px 16px",
        textAlign: right ? "right" : center ? "center" : "left",
        fontWeight: strong ? 700 : 400,
        color: muted ? "var(--text-2)" : "var(--text)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
