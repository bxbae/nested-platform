// 배치 위치: src/components/CompanionInvites.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { won } from "@/lib/format";
import {
  listCompanionInvites,
  respondToInvite,
  type CompanionInvite,
} from "@/lib/api/reservations";

// 내가 룸메이트로 초대된 예약들.
//
// 예약자(대표자)가 방을 잡으면서 나를 지정하면 여기에 뜬다. 비용은 예약자가
// 전액 결제하므로 수락은 "함께 살겠다"는 동의일 뿐 결제 의무는 없다.
// 응답 대기(PENDING) 건이 없으면 아무것도 렌더하지 않아 화면을 비우지 않는다.
export function CompanionInvites() {
  const [invites, setInvites] = useState<CompanionInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setInvites(await listCompanionInvites());
    } catch {
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function respond(id: string, decision: "accept" | "decline") {
    if (busyId) return;
    setBusyId(id);
    try {
      await respondToInvite(id, decision);
      await load();
    } catch {
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const pending = invites.filter((i) => i.companionStatus === "PENDING");
  const answered = invites.filter((i) => i.companionStatus !== "PENDING");

  // 로딩 중이거나 초대가 하나도 없으면 섹션 자체를 숨긴다.
  if (loading || invites.length === 0) return null;

  function fmt(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }

  return (
    <section style={{ marginBottom: 28 }}>
      <h2 className="display" style={{ fontSize: 20, marginBottom: 4 }}>
        룸메이트 초대
      </h2>
      <p style={{ color: "var(--text-2)", fontSize: 13.5, marginBottom: 14 }}>
        함께 살자는 제안이 왔어요. 비용은 예약한 분이 결제해요.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {pending.map((i) => (
          <div key={i.id} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/homes/${i.room.id}`}>
                  <strong style={{ fontSize: 15.5 }}>{i.room.name.trim()}</strong>
                </Link>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
                  {i.room.region} · {fmt(i.checkIn)} 입주 · {i.months}개월
                </div>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>
                  입주 시 결제 {won(i.totalDueNow)} (예약자 부담)
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, alignItems: "flex-start", flexShrink: 0 }}>
                <button
                  className="btn btn-primary press"
                  style={{ fontSize: 13, padding: "8px 16px", opacity: busyId === i.id ? 0.6 : 1 }}
                  onClick={() => respond(i.id, "accept")}
                  disabled={busyId === i.id}
                >
                  수락
                </button>
                <button
                  className="btn btn-ghost press"
                  style={{ fontSize: 13, padding: "8px 16px" }}
                  onClick={() => respond(i.id, "decline")}
                  disabled={busyId === i.id}
                >
                  거절
                </button>
              </div>
            </div>
          </div>
        ))}

        {answered.map((i) => (
          <div key={i.id} className="card" style={{ padding: 16, opacity: 0.65 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <strong style={{ fontSize: 14.5 }}>{i.room.name.trim()}</strong>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3 }}>
                  {fmt(i.checkIn)} 입주 · {i.months}개월
                </div>
              </div>
              <span
                className="chip"
                style={{
                  fontSize: 11,
                  background: i.companionStatus === "ACCEPTED" ? "var(--secondary)" : "var(--border)",
                  color: i.companionStatus === "ACCEPTED" ? "#fff" : "var(--text-2)",
                  border: "none",
                }}
              >
                {i.companionStatus === "ACCEPTED" ? "수락함" : "거절함"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
