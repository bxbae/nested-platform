"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { UserAvatar } from "@/components/UserAvatar";
import { UserBadges } from "@/components/UserBadges";
import {
  addFriend,
  removeFriend,
  type FriendProfile,
} from "@/lib/api/friends";
import { getMatchDetail, type MatchDetail } from "@/lib/api/match";
import { openDirectConversation } from "@/lib/api/messages";
import { SURVEY, type PreferenceAxis } from "@/lib/api/preference";
import { getPublicUserProfile } from "@/lib/api/users";

const AXIS_ICON: Record<PreferenceAxis, string> = {
  noise: "🔊",
  cleanliness: "🧹",
  smoking: "🚬",
  pets: "🐾",
  visitors: "👥",
  sleep: "🌙",
  sociability: "🗣️",
  sharedSpace: "🛋️",
  drinking: "🍺",
};

const ROLE_LABEL: Record<FriendProfile["role"], string> = {
  GUEST: "게스트",
  HOST: "호스트",
  ADMIN: "회원",
};

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendBusy, setFriendBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      setMatch(null);

      try {
        const nextProfile = await getPublicUserProfile(userId);
        if (!alive) return;
        setProfile(nextProfile);

        // 친구 목록과 룸메이트 매칭 모두 같은 상세 화면을 사용한다.
        // 현재 사용자와의 매칭 분석이 가능한 경우에만 오른쪽 요약을 표시한다.
        try {
          const nextMatch = await getMatchDetail(userId);
          if (alive) setMatch(nextMatch);
        } catch {
          if (alive) setMatch(null);
        }
      } catch (loadError) {
        if (!alive) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "프로필을 불러오지 못했습니다.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [userId]);

  const lifestyleItems = useMemo(() => {
    if (!profile?.lifestyle) return [];

    return SURVEY.map(({ axis, options }) => {
      const value = profile.lifestyle?.[axis];
      const label = options.find((option) => option.value === value)?.label;

      return {
        axis,
        icon: AXIS_ICON[axis],
        label: label ?? String(value ?? ""),
      };
    });
  }, [profile]);

  async function toggleFriend() {
    if (!profile || profile.isMe || friendBusy) return;

    setFriendBusy(true);
    try {
      if (profile.isFriend) {
        await removeFriend(profile.userId);
        setProfile({ ...profile, isFriend: false });
      } else {
        await addFriend(profile.userId);
        setProfile({ ...profile, isFriend: true });
      }
    } finally {
      setFriendBusy(false);
    }
  }

  async function sendMessage() {
    if (!profile || messageBusy) return;

    setMessageBusy(true);
    try {
      const conversation = await openDirectConversation(profile.userId);
      router.push(
        `/me/messages?direct=${encodeURIComponent(conversation.id)}`,
      );
    } finally {
      setMessageBusy(false);
    }
  }

  if (loading) {
    return <div className="wrap" style={stateStyle}>프로필을 불러오는 중…</div>;
  }

  if (error || !profile) {
    return (
      <div className="wrap" style={stateStyle}>
        {error ?? "사용자 프로필을 찾을 수 없습니다."}
      </div>
    );
  }

  const introduction =
    profile.intro || profile.bio || "등록된 자기소개가 없습니다.";

  return (
    <main className="wrap" style={{ maxWidth: 1180, paddingTop: 42, paddingBottom: 72 }}>
      <section className="card" style={headerCardStyle}>
        <UserAvatar
          name={profile.name}
          avatarUrl={profile.avatarUrl}
          avatarColor={profile.avatarColor}
          size={104}
          fontSize={38}
        />

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 className="display" style={{ margin: 0, fontSize: 34 }}>
              {profile.name}
            </h1>
            <UserBadges
              verified={profile.verified}
              tier={profile.tier}
              tierLabel={profile.tierLabel}
              size="md"
            />
          </div>

          <p style={{ margin: "8px 0 0", color: "var(--text-2)", fontSize: 14 }}>
            {[
              profile.ageGroup ? `${profile.ageGroup}대` : null,
              ROLE_LABEL[profile.role],
              `${profile.joinedYear}년 가입`,
              profile.job,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {!profile.isMe && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary press"
              disabled={messageBusy}
              onClick={() => void sendMessage()}
            >
              {messageBusy ? "여는 중…" : "메시지 보내기"}
            </button>
            <button
              type="button"
              className="btn btn-ghost press"
              disabled={friendBusy}
              onClick={() => void toggleFriend()}
            >
              {friendBusy
                ? "처리 중…"
                : profile.isFriend
                  ? "친구 삭제"
                  : "친구 추가"}
            </button>
          </div>
        )}
      </section>

      <div style={contentGridStyle}>
        <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <section className="card" style={sectionCardStyle}>
            <h2 style={sectionTitleStyle}>자기소개</h2>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
              {introduction}
            </p>

            <div style={{ marginTop: 22 }}>
              <h3 style={{ ...sectionTitleStyle, fontSize: 15, marginBottom: 10 }}>
                생활 키워드
              </h3>
              {profile.keywords.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {profile.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="chip"
                      style={{ color: "var(--primary)", fontWeight: 600 }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={mutedTextStyle}>등록된 생활 키워드가 없습니다.</p>
              )}
            </div>
          </section>

          <section className="card" style={sectionCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h2 style={sectionTitleStyle}>생활 성향</h2>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                사용자가 공개한 정보
              </span>
            </div>

            {lifestyleItems.length > 0 ? (
              <div style={lifestyleGridStyle}>
                {lifestyleItems.map((item) => (
                  <div key={item.axis} style={lifestyleItemStyle}>
                    <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>
                      {item.icon}
                    </span>
                    <div>
                      <strong style={{ display: "block", fontSize: 14 }}>
                        {item.label}
                      </strong>
                      <span style={{ color: "var(--text-2)", fontSize: 12.5 }}>
                        {SURVEY.find((survey) => survey.axis === item.axis)?.question}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={mutedTextStyle}>공개된 생활 성향 정보가 없습니다.</p>
            )}
          </section>
        </div>

        <aside style={{ display: "grid", gap: 20, alignContent: "start" }}>
          {match ? (
            <section className="card" style={sectionCardStyle}>
              <h2 style={sectionTitleStyle}>나와의 매칭 요약</h2>

              <div style={scoreGridStyle}>
                <Score label="매칭 점수" value={`${match.score}%`} icon="♥" />
                <Score
                  label="생활 성향 일치"
                  value={`${match.exactMatchCount}/${match.totalAxisCount}`}
                  icon="✓"
                />
                <Score
                  label="중요 조건 일치"
                  value={`${match.importantMatchCount}/${match.totalImportantCount}`}
                  icon="★"
                  wide
                />
              </div>

              <div style={{ marginTop: 24 }}>
                <h3 style={{ ...sectionTitleStyle, fontSize: 15 }}>잘 맞는 이유</h3>
                {match.reasons.length > 0 ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {match.reasons.map((reason) => (
                      <div key={reason} style={reasonRowStyle}>
                        <span style={checkStyle}>✓</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={mutedTextStyle}>일부 생활 성향에서 공통점이 있습니다.</p>
                )}
              </div>

              {match.adjustmentPoints.length > 0 && (
                <div style={warningStyle}>
                  <strong style={{ display: "block", marginBottom: 8 }}>
                    조율이 필요한 부분
                  </strong>
                  <div style={{ display: "grid", gap: 8 }}>
                    {match.adjustmentPoints.map((point) => (
                      <div key={point} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.5 }}>
                        <span aria-hidden="true">⚠</span>
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="card" style={sectionCardStyle}>
              <h2 style={sectionTitleStyle}>공개 프로필 안내</h2>
              <p style={{ ...mutedTextStyle, lineHeight: 1.7 }}>
                이메일, 전화번호, 생년월일, 상세 주소는 공개하지 않습니다.
                생활 성향 설문이 모두 완료된 경우에만 룸메이트 매칭 요약이 표시됩니다.
              </p>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function Score({
  label,
  value,
  icon,
  wide,
}: {
  label: string;
  value: string;
  icon: string;
  wide?: boolean;
}) {
  return (
    <div style={{ ...scoreStyle, gridColumn: wide ? "1 / -1" : undefined }}>
      <span aria-hidden="true" style={{ color: "var(--primary)", fontSize: 18 }}>
        {icon}
      </span>
      <div>
        <span style={{ display: "block", color: "var(--text-2)", fontSize: 11.5 }}>
          {label}
        </span>
        <strong style={{ display: "block", marginTop: 4, fontSize: 23 }}>
          {value}
        </strong>
      </div>
    </div>
  );
}

const stateStyle: CSSProperties = {
  maxWidth: 1180,
  paddingTop: 80,
  paddingBottom: 80,
  color: "var(--text-2)",
  textAlign: "center",
};

const headerCardStyle: CSSProperties = {
  padding: 28,
  display: "flex",
  alignItems: "center",
  gap: 22,
  flexWrap: "wrap",
};

const contentGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
  gap: 20,
  marginTop: 20,
};

const sectionCardStyle: CSSProperties = {
  padding: 24,
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 16px",
  fontSize: 18,
  fontWeight: 700,
};

const mutedTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--text-2)",
  fontSize: 13.5,
};

const lifestyleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
};

const lifestyleItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 11,
  padding: 14,
  border: "1px solid var(--border)",
  borderRadius: 14,
  background: "var(--bg-2)",
};

const scoreGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const scoreStyle: CSSProperties = {
  minWidth: 0,
  padding: 14,
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: "1px solid var(--border)",
  borderRadius: 14,
};

const reasonRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  fontSize: 14,
  lineHeight: 1.5,
};

const checkStyle: CSSProperties = {
  width: 18,
  height: 18,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  marginTop: 1,
  borderRadius: "50%",
  background: "#dff5e5",
  color: "#35a45f",
  fontSize: 11,
  fontWeight: 700,
};

const warningStyle: CSSProperties = {
  marginTop: 22,
  padding: 16,
  borderRadius: 14,
  border: "1px solid #efdba9",
  background: "#fffaf0",
};
