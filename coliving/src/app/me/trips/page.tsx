import { TripsList } from "@/components/TripsList";
import { CompanionInvites } from "@/components/CompanionInvites";

export const metadata = { title: "예약 내역 · Nested" };

export default function MeTrips() {
  return (
    <>
      {/* 받은 룸메이트 초대 — 대기 중인 게 없으면 아무것도 렌더하지 않는다 */}
      <CompanionInvites />
      <TripsList bare />
    </>
  );
}
