"use client";

import Link from "next/link";
import { currentUser } from "@/lib/me";
import { useAuth } from "@/lib/api/useAuth";

// Profile header for the My page. Shows the real logged-in name/email/initial
// when available (falling back to demo data), while joined-year / bio / role
// stay demo since they aren't stored server-side.
export function ProfileHeader() {
  const { user } = useAuth();
  const name = user?.name || currentUser.name;
  const email = user?.email || currentUser.email;
  const role =
    user?.role === "HOST" ? "호스트" : user ? "게스트" : currentUser.role;
  const initial = name.trim()[0] ?? "N";
  const joinYear = user?.createdAt
    ? new Date(user.createdAt).getFullYear()
    : currentUser.joined;
  // The API now returns `bio` (editable at /me/settings).
  const bio: string | null = user?.bio ?? null;

  return (
    <div className="card" style={{ padding: 26, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
      <span
        aria-hidden="true"
        style={{
          width: 72, height: 72, borderRadius: 99, flexShrink: 0,
          background: currentUser.avatarColor,
          display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 28,
        }}
      >
        {initial}
      </span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong style={{ fontSize: 20 }}>{name}</strong>
          <span className="chip" style={{ fontSize: 12 }}>{role}</span>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--text-2)", marginTop: 4 }}>
          {joinYear}년 가입 · {email}
        </div>
        <p
          style={{
            fontSize: 14,
            color: user && !bio ? "var(--text-2)" : "var(--text)",
            marginTop: 10,
          }}
        >
          {/* There's no bio field on the server yet, so a real account starts empty
              rather than borrowing the demo persona's blurb. */}
          {user ? (bio ?? "아직 자기소개가 없어요. 프로필 수정에서 추가해보세요.") : currentUser.bio}
        </p>
      </div>
      <Link href="/me/settings" className="btn btn-ghost press">프로필 수정</Link>
    </div>
  );
}
