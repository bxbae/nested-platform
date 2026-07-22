"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/api/useAuth";
import { USE_REAL_API } from "@/lib/api/config";
import { listFavoriteIds } from "@/lib/api/favorites";
import { unreadNotificationCount } from "@/lib/api/notifications";
import { wishlist, notifications } from "@/lib/me";

// Quick-link cards under the profile card. Badge counts come from the live API
// once signed in; the demo build keeps the sample numbers so the offline
// portfolio still looks populated.
//
// Messages has no unread flag on the server yet, so it renders without a badge
// rather than inventing one.
export function QuickCards() {
  const { user } = useAuth();
  const [saved, setSaved] = useState<number | null>(null);
  const [unreadNoti, setUnreadNoti] = useState<number | null>(null);

  useEffect(() => {
    if (!USE_REAL_API) {
      setSaved(wishlist().length);
      setUnreadNoti(notifications().filter((n) => n.unread).length);
      return;
    }
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [ids, unread] = await Promise.all([
        listFavoriteIds().catch(() => []),
        unreadNotificationCount().catch(() => 0),
      ]);
      if (cancelled) return;
      setSaved(ids.length);
      setUnreadNoti(unread);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <>
      <div className="stat-row" style={{ marginTop: 20 }}>
        <QuickCard href="/me/trips" icon="" label="예약 내역" />
        <QuickCard href="/me/wishlist" icon="♥" label="찜 목록" badge={saved ?? undefined} />
        <QuickCard href="/me/messages" icon="" label="메시지" accent />
        <QuickCard
          href="/me/notifications"
          icon=""
          label="알림"
          badge={unreadNoti ?? undefined}
          accent
        />
      </div>

      <div className="stat-row" style={{ marginTop: 14, gridTemplateColumns: "repeat(2, 1fr)" }}>
        <QuickCard href="/me/payments" icon="" label="결제 내역" />
        <QuickCard href="/me/reviews" icon="" label="리뷰 관리" />
      </div>
    </>
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
