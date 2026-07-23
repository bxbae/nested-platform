"use client";

import { useEffect, useState } from "react";
import {
  claimBirthdayCoupon,
  getBirthdayCouponStatus,
  type BirthdayCouponStatus,
} from "@/lib/api/birthday-coupon";

// 생일 당일에만 나타나는 쿠폰 카드. 생일이 아니면 아무것도 렌더하지 않아
// 마이페이지가 평소에는 그대로 보인다.
export function BirthdayCouponCard() {
  const [status, setStatus] = useState<BirthdayCouponStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getBirthdayCouponStatus()
      .then((s) => { if (alive) setStatus(s); })
      .catch(() => { /* 조회 실패 시 카드를 숨긴다 */ });
    return () => { alive = false; };
  }, []);

  if (!status || !status.isBirthday) return null;

  const claim = async () => {
    setClaiming(true);
    setError(null);
    try {
      const res = await claimBirthdayCoupon();
      setStatus({ ...status, claimed: true, code: res.code, validTo: res.validTo });
    } catch (e) {
      setError(e instanceof Error ? e.message : "쿠폰을 받지 못했어요.");
    } finally {
      setClaiming(false);
    }
  };

  const won = status.discount.toLocaleString("ko-KR");

  return (
    <div
      className="card"
      style={{
        padding: 20,
        marginBottom: 16,
        border: "1.5px solid var(--primary)",
        background: "rgba(255,90,95,0.06)",
      }}
    >
      <strong style={{ fontSize: 16 }}>생일 축하드려요</strong>
      <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 6, lineHeight: 1.6 }}>
        {status.claimed
          ? `${won}원 할인 쿠폰을 받으셨어요. 결제할 때 아래 코드를 입력하세요.`
          : `오늘 하루, ${won}원 할인 쿠폰을 받을 수 있어요.`}
      </p>

      {status.claimed && status.code ? (
        <div style={{ marginTop: 12 }}>
          <code
            style={{
              display: "inline-block", padding: "8px 12px",
              borderRadius: "var(--r-sm)", background: "var(--surface)",
              border: "1px solid var(--border)", fontSize: 15, fontWeight: 600,
            }}
          >
            {status.code}
          </code>
          {status.validTo && (
            <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 8 }}>
              {new Date(status.validTo).toLocaleDateString("ko-KR")}까지 사용할 수 있어요.
            </p>
          )}
        </div>
      ) : (
        <button
          className="btn btn-primary press"
          style={{ marginTop: 12 }}
          onClick={() => void claim()}
          disabled={claiming}
        >
          {claiming ? "받는 중…" : "쿠폰 받기"}
        </button>
      )}

      {error && (
        <p style={{ fontSize: 13, color: "var(--primary)", marginTop: 10 }}>{error}</p>
      )}
    </div>
  );
}
