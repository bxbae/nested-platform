import { NextRequest, NextResponse } from "next/server";
import { houses } from "@/lib/data";
import { listBookings } from "@/lib/store";
import { addMonths } from "@/lib/pricing";
import type { BookingMode } from "@/lib/types";

// GET /api/availability?houseId=&checkIn=&months=&bookingMode=&reservedSpots=
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const houseId = p.get("houseId");
  const checkInStr = p.get("checkIn");
  const months = Number(p.get("months") ?? 0);
  const requestedMode = (p.get("bookingMode") ?? "unit") as BookingMode;
  const requestedSpots = Math.max(1, Number(p.get("reservedSpots") ?? 1));

  const house = houses.find((item) => item.id === houseId);
  if (!house) {
    return NextResponse.json(
      { available: false, reason: "숙소를 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  if (!checkInStr || !months) {
    return NextResponse.json({ available: false, reason: "날짜와 기간을 선택하세요." });
  }

  const checkIn = new Date(checkInStr);
  const checkOut = addMonths(checkIn, months);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (checkIn < now) {
    return NextResponse.json({ available: false, reason: "입주일은 오늘 이후여야 합니다." });
  }
  if (months < house.minStayMonths) {
    return NextResponse.json({
      available: false,
      reason: `최소 ${house.minStayMonths}개월 이상 예약해야 합니다.`,
    });
  }
  if (checkIn < new Date(house.availableFrom)) {
    return NextResponse.json({
      available: false,
      reason: `${house.availableFrom}부터 입주 가능합니다.`,
      availableFrom: house.availableFrom,
    });
  }

  const overlaps = listBookings().filter((booking) => {
    if (booking.houseId !== house.id || booking.status === "cancelled") return false;
    const bookingIn = new Date(booking.moveIn);
    const bookingOut = addMonths(bookingIn, booking.months);
    return bookingIn < checkOut && bookingOut > checkIn;
  });

  if (house.rentalUnit !== "bed") {
    if (overlaps.length > 0) {
      return NextResponse.json({
        available: false,
        reason: "선택한 기간은 이미 예약되었습니다.",
      });
    }
    return NextResponse.json({
      available: true,
      checkOut: checkOut.toISOString().slice(0, 10),
      remainingSpots: null,
    });
  }

  const capacity = Math.max(1, house.capacity ?? 1);
  if (requestedMode === "whole_room" && overlaps.length > 0) {
    return NextResponse.json({
      available: false,
      reason: "다른 예약이 있어 방 전체를 예약할 수 없습니다.",
    });
  }

  const occupied = overlaps.reduce((sum, booking) => {
    if (booking.bookingMode !== "bed") return capacity;
    return sum + Math.max(1, booking.reservedSpots ?? 1);
  }, 0);
  const spots = requestedMode === "whole_room" ? capacity : requestedSpots;
  const remaining = Math.max(0, capacity - occupied);

  if (spots > remaining) {
    return NextResponse.json({
      available: false,
      reason: `선택한 기간에 남은 자리가 ${remaining}개뿐입니다.`,
    });
  }

  return NextResponse.json({
    available: true,
    checkOut: checkOut.toISOString().slice(0, 10),
    remainingSpots: remaining - spots,
  });
}
