import { NextRequest, NextResponse } from "next/server";
import { houses } from "@/lib/data";
import { addBooking, listBookings, updateBooking } from "@/lib/store";
import { computePrice, addMonths } from "@/lib/pricing";
import type { Booking, BookingMode } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ bookings: listBookings() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const house = houses.find((item) => item.id === body.houseId);
  if (!house) {
    return NextResponse.json({ error: "숙소를 찾을 수 없습니다." }, { status: 404 });
  }

  const months = Math.max(house.minStayMonths, Number(body.months) || house.minStayMonths);
  const checkIn = new Date(body.moveIn || house.availableFrom);
  const checkOut = addMonths(checkIn, months);
  const isBed = house.rentalUnit === "bed";
  const capacity = Math.max(1, house.capacity ?? 1);
  const bookingMode: BookingMode = isBed
    ? body.bookingMode === "whole_room"
      ? "whole_room"
      : "bed"
    : "unit";
  const reservedSpots = isBed
    ? bookingMode === "whole_room"
      ? capacity
      : Math.max(1, Math.min(capacity, Number(body.reservedSpots) || 1))
    : 1;

  const overlaps = listBookings().filter((booking) => {
    if (booking.houseId !== house.id || booking.status === "cancelled") return false;
    const bookingIn = new Date(booking.moveIn);
    const bookingOut = addMonths(bookingIn, booking.months);
    return bookingIn < checkOut && bookingOut > checkIn;
  });

  if (!isBed || bookingMode === "whole_room") {
    if (overlaps.length > 0) {
      return NextResponse.json(
        { error: "선택한 기간은 이미 예약되었습니다." },
        { status: 409 },
      );
    }
  } else {
    const occupied = overlaps.reduce((sum, booking) => {
      if (booking.bookingMode !== "bed") return capacity;
      return sum + Math.max(1, booking.reservedSpots ?? 1);
    }, 0);
    if (occupied + reservedSpots > capacity) {
      return NextResponse.json(
        { error: `선택한 기간에 남은 자리가 ${Math.max(0, capacity - occupied)}개뿐입니다.` },
        { status: 409 },
      );
    }
  }

  const units = isBed ? reservedSpots : 1;
  const price = computePrice({
    monthlyRent: house.monthlyRent * units,
    deposit: house.deposit * units,
    cleaningFee: house.cleaningFee * units,
    maintenanceFee: house.maintenanceFee * units,
    months,
  });

  const booking: Booking = {
    id: `b${Date.now()}`,
    houseId: house.id,
    houseName: house.name,
    guestName: body.guestName || "게스트",
    moveIn: body.moveIn || house.availableFrom,
    months,
    monthlyRent: price.monthlyRent,
    deposit: price.deposit,
    cleaningFee: price.cleaningFee,
    maintenanceFee: price.maintenanceFee,
    serviceFee: price.serviceFee,
    totalDueNow: price.dueNow,
    serviceFeeRate: 0.05,
    bookingMode,
    reservedSpots,
    status: body.action === "pay" ? "paid" : "hold",
    createdAt: new Date().toISOString(),
  };
  addBooking(booking);
  return NextResponse.json({ booking });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const status = body.status === "paid" ? "paid" : "cancelled";
  const updated = updateBooking(body.id, { status });
  if (!updated) {
    return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ booking: updated });
}
