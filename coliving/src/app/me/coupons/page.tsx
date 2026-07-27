"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  couponStatusLabel,
  listMyCoupons,
  type MyCoupon,
} from "@/lib/api/coupons";
import { useAuth } from "@/lib/api/useAuth";
import { won } from "@/lib/format";

function dateLabel(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function benefitLabel(coupon: MyCoupon): string {
  if (coupon.type === "PERCENT") {
    return `${coupon.value}% 할인${coupon.maxDiscount ? ` · 최대 ${won(coupon.maxDiscount)}` : ""}`;
  }
  return `${won(coupon.value)} 할인`;
}

export default function MyCouponsPage() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<MyCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    listMyCoupons()
      .then((rows) => {
        if (alive) setCoupons(rows);
      })
      .catch((reason) => {
        if (alive) setError(reason instanceof Error ? reason.message : "쿠폰을 불러오지 못했어요.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const available = useMemo(
    () => coupons.filter((coupon) => coupon.status === "AVAILABLE"),
    [coupons],
  );
  const unavailable = useMemo(
    () => coupons.filter((coupon) => coupon.status !== "AVAILABLE"),
    [coupons],
  );

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>내 쿠폰</h1>
      <p style={{ color: "var(--text-2)", lineHeight: 1.65, marginBottom: 18 }}>
        예약할 때 사용할 수 있는 공용 쿠폰과 내 생일 쿠폰을 확인하세요.
        쿠폰 할인은 보증금·청소비·관리비가 아닌 첫 달 월세에만 적용됩니다.
      </p>

      {!user?.birthDate && (
        <div className="card" style={{ padding: 16, marginBottom: 16, background: "var(--bg-2)" }}>
          <strong style={{ fontSize: 14 }}>생일 쿠폰을 받으려면 생년월일을 등록해주세요.</strong>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
            생일 당일 자동 발급되며 발급일부터 7일 동안 사용할 수 있습니다.
          </p>
          <Link href="/me/settings" className="btn btn-ghost press" style={{ marginTop: 10, fontSize: 12.5 }}>
            설정에서 생년월일 등록
          </Link>
        </div>
      )}

      {loading && <p style={{ color: "var(--text-2)" }}>쿠폰을 불러오는 중…</p>}
      {error && <p style={{ color: "var(--primary)" }}>{error}</p>}

      {!loading && (
        <>
          <CouponSection title={`사용 가능 ${available.length}개`} coupons={available} />
          <CouponSection title="사용 완료·기간 만료" coupons={unavailable} muted />
        </>
      )}
    </div>
  );
}

function CouponSection({
  title,
  coupons,
  muted = false,
}: {
  title: string;
  coupons: MyCoupon[];
  muted?: boolean;
}) {
  return (
    <section style={{ marginTop: 18 }}>
      <h2 style={{ fontSize: 16, marginBottom: 10 }}>{title}</h2>
      {coupons.length === 0 ? (
        <div className="card" style={{ padding: 24, color: "var(--text-2)", textAlign: "center" }}>
          표시할 쿠폰이 없습니다.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {coupons.map((coupon) => (
            <article key={coupon.id} className="card" style={{ padding: 18, opacity: muted ? 0.68 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong>{coupon.kind === "BIRTHDAY" ? "생일 축하 쿠폰" : coupon.code}</strong>
                    <span className="chip" style={{ fontSize: 11 }}>{benefitLabel(coupon)}</span>
                    <span className="chip" style={{ fontSize: 11 }}>{couponStatusLabel(coupon.status)}</span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 7 }}>
                    {dateLabel(coupon.validFrom)} ~ {dateLabel(coupon.validTo)}
                  </p>
                  <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3 }}>
                    첫 달 월세에만 적용
                    {coupon.minSpend > 0 ? ` · 월세 ${won(coupon.minSpend)} 이상` : ""}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
