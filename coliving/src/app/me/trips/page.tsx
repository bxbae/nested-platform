import { TripsList } from "@/components/TripsList";
import { CompanionInvites } from "@/components/CompanionInvites";

export const metadata = { title: "예약 관리 · Nested" };

export default function MeTrips() {
  return (
    <>
      <header style={{ marginBottom: 24 }}>
        <h1
          className="display"
          style={{ fontSize: 30, marginBottom: 6 }}
        >
          예약 관리
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: 14 }}>
          진행 중인 룸메이트 초대와 예약을 먼저 확인하고, 종료된 기록은
          별도로 관리할 수 있어요.
        </p>
      </header>

      <CompanionInvites />
      <TripsList bare />
    </>
  );
}
