import { NextRequest, NextResponse } from "next/server";
import { houses } from "@/lib/data";
import {
  addBooking,
  listBookings,
  updateBooking,
} from "@/lib/store";
import { computePrice, addMonths } from "@/lib/pricing";
import type { Booking } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ bookings: listBookings() });
}

// POST /api/bookings — create a reservation.
// body.action = "request" → status "hold" (예약 요청)
//             = "pay"     → status "paid" (결제 완료)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const house = houses.find((h) => h.id === body.houseId);
  if (!house) {
    return NextResponse.json({ error: "숙소를 찾을 수 없습니다." }, { status: 404 });
  }

  const months = Math.max(house.minStayMonths, Number(body.months) || house.minStayMonths);
  const checkIn = new Date(body.moveIn || house.availableFrom);
  const checkOut = addMonths(checkIn, months);

  // double-booking check (mirrors backend overlap logic)
  const overlaps = listBookings().filter((b) => {
    if (b.houseId !== house.id || b.status === "cancelled") return false;
    const bIn = new Date(b.moveIn);
    const bOut = addMonths(bIn, b.months);
    return bIn < checkOut && bOut > checkIn;
  });
  if (overlaps.length > 0) {
    return NextResponse.json(
      { error: "선택한 기간은 이미 예약되었습니다." },
      { status: 409 }
    );
  }

  // authoritative price recompute (client never supplies the total)
  const price = computePrice({
    monthlyRent: house.monthlyRent,
    deposit: house.deposit,
    cleaningFee: house.cleaningFee,
    maintenanceFee: house.maintenanceFee,
    months,
  });

  const booking: Booking = {
    id: `b${Date.now()}`,
    houseId: house.id,
    houseName: house.name,
    guestName: body.guestName || "게스트",
    moveIn: body.moveIn || house.availableFrom,
    months,
    monthlyRent: house.monthlyRent,
    deposit: house.deposit,
    cleaningFee: house.cleaningFee,
    maintenanceFee: house.maintenanceFee,
    serviceFee: price.serviceFee,
    totalDueNow: price.dueNow,
    serviceFeeRate: 0.05,
    status: body.action === "pay" ? "paid" : "hold",
    createdAt: new Date().toISOString(),
  };
  addBooking(booking);
  return NextResponse.json({ booking });
}

// PATCH — confirm payment on a held booking, or cancel.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const status = body.status === "paid" ? "paid" : "cancelled";
  const updated = updateBooking(body.id, { status });
  if (!updated) {
    return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ booking: updated });
}
