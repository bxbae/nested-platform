// 배치 위치: src/components/UserProfileModal.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { USE_REAL_API } from "@/lib/api/config";
import { useAuth } from "@/lib/api/useAuth";
import { UserBadges, type ActivityTier } from "@/components/UserBadges";

// 커뮤니티·리뷰에서 이름을 눌렀을 때 뜨는 프로필 카드.
//
// 페이지 이동 대신 모달을 쓴 이유: 글을 읽다가 "이 사람 누구지" 하고 잠깐
// 확인하는 흐름이라, 화면이 바뀌면 읽던 자리를 잃는다.

interface PublicProfile {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  bio: string | null;
  gender: "MALE" | "FEMALE" | "OTHER";
  joinedYear: number;
  verified: boolean;
  tier: ActivityTier;
  tierLabel: string;
  keywords: string[];
}

export function UserProfileModal({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setError(null);
      return;
    }
    if (!USE_REAL_API) return;

    let alive = true;
    setLoading(true);
    setError(null);
    api
      .get<PublicProfile>(`/users/${userId}`, { auth: false })
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch(() => {
        if (alive) setError("프로필을 불러오지 못했어요.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  // Esc 로 닫기 — 모달의 기본 기대 동작이다.
  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userId, onClose]);

  if (!userId) return null;

  const isSelf = user?.id === userId;

  async function startChat() {
    if (starting || !profile) return;
    if (!user) {
      alert("로그인이 필요해요.");
      return;
    }
    setStarting(true);
    try {
      const conv = await api.post<{ id: string }>("/messages/direct", {
        targetUserId: profile.id,
      });
      onClose();
      router.push(`/me/messages?conversation=${conv.id}`);
    } catch {
      setError("대화를 시작하지 못했어요.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        role="dialog"
        aria-label="사용자 프로필"
        style={{ width: "min(380px, 100%)", padding: 24 }}
      >
        {loading && <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>}
        {error && !loading && <p style={{ color: "var(--primary)" }}>{error}</p>}

        {profile && !loading && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: profile.avatarUrl
                    ? `center/cover url(${profile.avatarUrl})`
                    : profile.avatarColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 22,
                }}
              >
                {!profile.avatarUrl && profile.name.charAt(0)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 17 }}>{profile.name}</strong>
                  <UserBadges
                    verified={profile.verified}
                    tier={profile.tier}
                    tierLabel={profile.tierLabel}
                  />
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3 }}>
                  {profile.joinedYear}년 가입
                  {profile.gender !== "OTHER" &&
                    ` · ${profile.gender === "MALE" ? "남성" : "여성"}`}
                </div>
              </div>
            </div>

            {profile.bio && (
              <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 16, whiteSpace: "pre-wrap" }}>
                {profile.bio}
              </p>
            )}

            {profile.keywords.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                {profile.keywords.slice(0, 6).map((k) => (
                  <span
                    key={k}
                    className="chip"
                    style={{ fontSize: 11, background: "var(--bg-2)", color: "var(--primary)", border: "none" }}
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              {!isSelf && (
                <button
                  className="btn btn-primary press"
                  style={{ flex: 1, justifyContent: "center", opacity: starting ? 0.6 : 1 }}
                  onClick={startChat}
                  disabled={starting}
                >
                  {starting ? "여는 중…" : "메시지 보내기"}
                </button>
              )}
              <button
                className="btn btn-ghost press"
                style={{ flex: isSelf ? 1 : undefined, justifyContent: "center" }}
                onClick={onClose}
              >
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
