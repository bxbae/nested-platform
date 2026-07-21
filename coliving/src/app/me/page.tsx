import { ProfileHeader } from "./ProfileHeader";
import { PreferenceSummary } from "./PreferenceSummary";
import { TierGuide } from "./TierGuide";
import { MyBadges } from "@/components/MyBadges";

export const metadata = { title: "프로필 · Nested" };

export default function Profile() {
  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>프로필</h1>

      {/* profile card */}
      <ProfileHeader />

      {/* 리뷰 기반 배지 */}
      <MyBadges />

      {/* 활동 등급 기준 + 내 위치 */}
      <TierGuide />

      {/* quick links — badge counts are fetched client-side from the live API */}
      <PreferenceSummary />
    </div>
  );
}
