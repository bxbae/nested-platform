import { ProfileHeader } from "./ProfileHeader";
import { QuickCards } from "./QuickCards";

export const metadata = { title: "프로필 · Nested" };

export default function Profile() {
  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>프로필</h1>

      {/* profile card */}
      <ProfileHeader />

      {/* quick links — badge counts are fetched client-side from the live API */}
      <QuickCards />
    </div>
  );
}
