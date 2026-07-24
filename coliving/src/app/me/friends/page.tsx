"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/UserAvatar";
import { UserBadges } from "@/components/UserBadges";
import {
  listFriends,
  removeFriend,
  type FriendProfile,
} from "@/lib/api/friends";
import { openDirectConversation } from "@/lib/api/messages";

export default function FriendsPage() {
  const router = useRouter();
  const [items, setItems] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    void listFriends()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  async function message(userId: string) {
    setBusyUserId(userId);
    try {
      const room = await openDirectConversation(userId);
      router.push(`/me/messages?direct=${encodeURIComponent(room.id)}`);
    } finally {
      setBusyUserId(null);
    }
  }

  async function remove(userId: string) {
    setBusyUserId(userId);
    try {
      await removeFriend(userId);
      setItems((current) => current.filter((item) => item.userId !== userId));
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 20 }}>
        친구 목록
      </h1>

      {loading ? (
        <p>불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          아직 추가한 친구가 없습니다.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((friend) => {
            const intro =
              friend.intro || friend.bio || "등록된 자기소개가 없습니다.";
            const isBusy = busyUserId === friend.userId;

            return (
              <article
                key={friend.userId}
                className="card"
                style={{
                  padding: 18,
                  display: "flex",
                  alignItems: "center",
                  gap: 15,
                  flexWrap: "wrap",
                }}
              >
                <UserAvatar
                  name={friend.name}
                  avatarUrl={friend.avatarUrl}
                  avatarColor={friend.avatarColor}
                  size={56}
                />

                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <strong>{friend.name}</strong>
                    <UserBadges
                      verified={friend.verified}
                      tier={friend.tier}
                      tierLabel={friend.tierLabel}
                    />
                  </div>

                  <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3 }}>
                    {[
                      friend.ageGroup ? `${friend.ageGroup}대` : null,
                      friend.role === "HOST" ? "호스트" : "게스트",
                      friend.job,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "프로필 정보 없음"}
                  </div>

                  <p
                    style={{
                      margin: "7px 0 0",
                      color: "var(--text-2)",
                      fontSize: 13.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {intro}
                  </p>

                  {friend.keywords.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {friend.keywords.slice(0, 3).map((keyword) => (
                        <span key={keyword} className="chip" style={{ fontSize: 11, padding: "5px 9px" }}>
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link className="btn btn-ghost" href={`/users/${friend.userId}`}>
                    프로필 보기
                  </Link>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isBusy}
                    onClick={() => void message(friend.userId)}
                  >
                    메시지
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={isBusy}
                    onClick={() => void remove(friend.userId)}
                  >
                    삭제
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
