import { NextRequest, NextResponse } from "next/server";
import { houses } from "@/lib/data";
import { listBookings } from "@/lib/store";
import { addMonths } from "@/lib/pricing";

// GET /api/availability?houseId=&checkIn=&months=
// Returns whether the requested stay can be booked (예약 가능 여부).
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const houseId = p.get("houseId");
  const checkInStr = p.get("checkIn");
  const months = Number(p.get("months") ?? 0);

  const house = houses.find((h) => h.id === houseId);
  if (!house) {
    return NextResponse.json({ available: false, reason: "숙소를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!checkInStr || !months) {
    return NextResponse.json({ available: false, reason: "날짜와 기간을 선택하세요." });
  }

  const checkIn = new Date(checkInStr);
  const checkOut = addMonths(checkIn, months);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // past date
  if (checkIn < now) {
    return NextResponse.json({ available: false, reason: "입주일은 오늘 이후여야 합니다." });
  }
  // min stay
  if (months < house.minStayMonths) {
    return NextResponse.json({
      available: false,
      reason: `최소 ${house.minStayMonths}개월 이상 예약해야 합니다.`,
    });
  }
  // available-from
  if (checkIn < new Date(house.availableFrom)) {
    return NextResponse.json({
      available: false,
      reason: `${house.availableFrom}부터 입주 가능합니다.`,
      availableFrom: house.availableFrom,
    });
  }

  // overlap with existing non-cancelled bookings for this house
  const overlaps = listBookings().filter((b) => {
    if (b.houseId !== house.id || b.status === "cancelled") return false;
    const bIn = new Date(b.moveIn);
    const bOut = addMonths(bIn, b.months);
    return bIn < checkOut && bOut > checkIn; // interval overlap
  });

  if (overlaps.length > 0) {
    return NextResponse.json({
      available: false,
      reason: "선택한 기간은 이미 예약되었습니다.",
    });
  }

  return NextResponse.json({
    available: true,
    checkOut: checkOut.toISOString().slice(0, 10),
  });
}
