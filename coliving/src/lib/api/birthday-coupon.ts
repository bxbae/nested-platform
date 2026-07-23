import { api } from "./client";

// 생일 쿠폰 — 생일 당일에 본인이 직접 청구한다.
// 쿠폰 자체는 기존 Coupon 테이블에 사용자·연도별 유니크 코드로 발급되므로,
// 결제 화면에서는 평소처럼 코드를 입력해 쓰면 된다.

export interface BirthdayCouponStatus {
  hasBirthDate: boolean;
  isBirthday: boolean;
  claimed: boolean;
  code: string | null;
  discount: number;
  validTo: string | null;
}

export interface BirthdayCouponClaim {
  code: string;
  discount: number;
  validTo: string;
}

export async function getBirthdayCouponStatus(): Promise<BirthdayCouponStatus> {
  return api.get<BirthdayCouponStatus>("/me/birthday-coupon");
}

export async function claimBirthdayCoupon(): Promise<BirthdayCouponClaim> {
  return api.post<BirthdayCouponClaim>("/me/birthday-coupon", {});
}
