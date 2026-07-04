export const won = (n: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(n);

export const wonShort = (n: number) => `₩${(n / 10000).toFixed(0)}만`;

export function bookingTotal(
  monthlyRent: number,
  months: number,
  deposit: number,
  feeRate: number
) {
  const rentTotal = monthlyRent * months;
  const serviceFee = Math.round(monthlyRent * feeRate);
  const dueNow = deposit + monthlyRent + serviceFee; // deposit + first month + fee
  return { rentTotal, serviceFee, dueNow };
}
