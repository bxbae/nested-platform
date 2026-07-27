import { api } from "./client";

export type MyCouponStatus =
  | "AVAILABLE"
  | "USED"
  | "EXPIRED"
  | "NOT_STARTED"
  | "MIN_SPEND";

export interface MyCoupon {
  id: string;
  code: string;
  kind: "GENERAL" | "BIRTHDAY";
  type: "FIXED" | "PERCENT";
  value: number;
  maxDiscount: number | null;
  minSpend: number;
  validFrom: string;
  validTo: string;
  status: MyCouponStatus;
  discountAmount: number | null;
  effectivePercent: number | null;
  appliesTo: "FIRST_MONTH_RENT";
}

export async function listMyCoupons(
  monthlyRent?: number,
): Promise<MyCoupon[]> {
  const query =
    monthlyRent != null
      ? `?monthlyRent=${encodeURIComponent(String(Math.round(monthlyRent)))}`
      : "";
  return api.get<MyCoupon[]>(`/me/coupons${query}`);
}

export function couponStatusLabel(status: MyCouponStatus): string {
  if (status === "AVAILABLE") return "사용 가능";
  if (status === "USED") return "사용 완료";
  if (status === "NOT_STARTED") return "사용 예정";
  if (status === "MIN_SPEND") return "월세 조건 미충족";
  return "기간 만료 또는 소진";
}
