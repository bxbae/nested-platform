import Link from "next/link";
import { wishlist, threads, notifications } from "@/lib/me";
import { ProfileHeader } from "./ProfileHeader";

export const metadata = { title: "프로필 · Nested" };

export default function Profile() {
  const savedCount = wishlist().length;
  const unreadMsg = threads().filter((t) => t.unread).length;
  const unreadNoti = notifications().filter((n) => n.unread).length;

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>프로필</h1>

      {/* profile card */}
      <ProfileHeader />

      {/* quick links */}
      <div className="stat-row" style={{ marginTop: 20 }}>
        <QuickCard href="/me/trips" icon="📋" label="예약 내역" />
        <QuickCard href="/me/wishlist" icon="♥" label="찜 목록" badge={savedCount} />
        <QuickCard href="/me/messages" icon="💬" label="메시지" badge={unreadMsg} accent />
        <QuickCard href="/me/notifications" icon="🔔" label="알림" badge={unreadNoti} accent />
      </div>

      <div className="stat-row" style={{ marginTop: 14, gridTemplateColumns: "repeat(2, 1fr)" }}>
        <QuickCard href="/me/payments" icon="💳" label="결제 내역" />
        <QuickCard href="/me/reviews" icon="⭐" label="리뷰 관리" />
      </div>
    </div>
  );
}

function QuickCard({
  href, icon, label, badge, accent,
}: {
  href: string; icon: string; label: string; badge?: number; accent?: boolean;
}) {
  return (
    <Link href={href} className="card hover-card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 22 }} aria-hidden="true">{icon}</span>
      <span style={{ fontSize: 14.5, fontWeight: 600, flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span
          style={{
            minWidth: 20, height: 20, borderRadius: 99, padding: "0 6px",
            background: accent ? "var(--primary)" : "var(--bg-2)",
            color: accent ? "#fff" : "var(--text-2)",
            fontSize: 12, fontWeight: 700,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
