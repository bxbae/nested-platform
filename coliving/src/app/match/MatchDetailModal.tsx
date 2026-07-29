"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  addFriend,
  getFriendStatus,
  removeFriend,
  type FriendRequestState,
} from "@/lib/api/friends";
import { openDirectConversation } from "@/lib/api/messages";
import { genderLabel, getMatchDetail, type MatchDetail } from "@/lib/api/match";

interface MatchDetailModalProps {
  userId: string | null;
  onClose: () => void;
}

export default function MatchDetailModal({
  userId,
  onClose,
}: MatchDetailModalProps) {
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestState, setFriendRequestState] =
    useState<FriendRequestState>("NONE");
  const [friendRequestId, setFriendRequestId] = useState<string | null>(null);
  const [friendBusy, setFriendBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!userId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      setIsFriend(false);
      setFriendRequestState("NONE");
      setFriendRequestId(null);
      return;
    }

    const targetUserId = userId;
    let alive = true;

    async function loadDetail() {
      setLoading(true);
      setError(null);
      setDetail(null);
      setIsFriend(false);
      setFriendRequestState("NONE");
      setFriendRequestId(null);

      try {
        const data = await getMatchDetail(targetUserId);

        if (!alive) return;

        setDetail(data);
        const status = await getFriendStatus(targetUserId);

        if (alive) {
          setIsFriend(status.isFriend);
          setFriendRequestState(status.requestState);
          setFriendRequestId(status.requestId);
        }
      } catch (loadError) {
        if (!alive) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "상세 정보를 불러오지 못했습니다.",
        );
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || friendRequestState !== "SENT") {
      return;
    }

    // null 검사를 통과한 사용자 ID를 문자열로 고정
    const targetUserId = userId;
    let alive = true;

    async function refreshFriendStatus() {
      try {
        const status = await getFriendStatus(targetUserId);

        if (!alive) return;

        setIsFriend(status.isFriend);
        setFriendRequestState(status.requestState);
        setFriendRequestId(status.requestId);
      } catch {
        // 일시적인 통신 오류가 발생해도
        // 다음 주기에 다시 확인한다.
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshFriendStatus();
    }, 4000);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [userId, friendRequestState]);

  async function handleFriendAction() {
    if (!detail || friendBusy) {
      return;
    }

    // 이미 요청을 보낸 상태라면 아무 동작도 하지 않는다.
    if (friendRequestState === "SENT") {
      return;
    }

    // 상대방에게 받은 요청이 있으면 요청 관리 화면으로 이동한다.
    if (friendRequestState === "RECEIVED") {
      const requestUrl = friendRequestId
        ? `/me/friends?tab=requests&requestId=${encodeURIComponent(
            friendRequestId,
          )}`
        : "/me/friends?tab=requests";

      router.push(requestUrl);
      return;
    }

    setFriendBusy(true);

    try {
      // 이미 친구라면 친구 삭제
      if (isFriend) {
        await removeFriend(detail.userId);

        setIsFriend(false);
        setFriendRequestState("NONE");
        setFriendRequestId(null);
        return;
      }

      // 친구가 아니라면 친구 요청 전송
      const result = await addFriend(detail.userId);

      setIsFriend(result.isFriend);
      setFriendRequestState(result.requestState);
      setFriendRequestId(result.requestId);
    } finally {
      setFriendBusy(false);
    }
  }

  useEffect(() => {
    if (!userId) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const originalOverflow = document.body.style.overflow;

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [userId, onClose]);

  if (!userId) {
    return null;
  }

  return (
    <div role="presentation" style={overlayStyle} onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="룸메이트 매칭 상세 정보"
        style={modalStyle}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="상세창 닫기"
          onClick={onClose}
          style={closeButtonStyle}
        >
          ×
        </button>

        {loading && (
          <div style={stateMessageStyle}>상세 정보를 불러오는 중…</div>
        )}

        {error && (
          <div
            style={{
              ...stateMessageStyle,
              color: "#d33",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && detail && (
          <div style={contentGridStyle}>
            <ProfileSection detail={detail} />
            <MatchAnalysisSection
              detail={detail}
              isFriend={isFriend}
              friendRequestState={friendRequestState}
              friendBusy={friendBusy}
              onFriendAction={handleFriendAction}
              onViewProfile={() =>
                router.push(`/users/${encodeURIComponent(detail.userId)}`)
              }
              onMessage={async () => {
                const conversation = await openDirectConversation(
                  detail.userId,
                );

                router.push(
                  `/me/messages?direct=${encodeURIComponent(conversation.id)}`,
                );
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileSection({ detail }: { detail: MatchDetail }) {
  return (
    <section style={profileSectionStyle}>
      <ProfilePhoto
        src={detail.avatarUrl}
        color={detail.avatarColor}
        name={detail.name}
      />

      <div>
        <h2
          className="display"
          style={{
            margin: 0,
            fontSize: 24,
          }}
        >
          {detail.name}
        </h2>

        <p style={metaTextStyle}>
          {[
            genderLabel(detail.gender),
            detail.ageGroup ? `${detail.ageGroup}대` : null,
            detail.job,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <p style={metaTextStyle}>{detail.joinedYear}년 가입</p>
      </div>

      <div>
        <h3 style={sectionTitleStyle}>자기소개</h3>

        <p style={introTextStyle}>
          {detail.intro || detail.bio || "등록된 자기소개가 없습니다."}
        </p>
      </div>

      <div>
        <h3 style={sectionTitleStyle}>생활 키워드</h3>

        {detail.keywords.length > 0 ? (
          <div style={chipWrapStyle}>
            {detail.keywords.slice(0, 5).map((keyword) => (
              <span key={keyword} style={chipStyle}>
                {keyword}
              </span>
            ))}

            {detail.keywords.length > 5 && (
              <span style={neutralChipStyle}>
                +{detail.keywords.length - 5}
              </span>
            )}
          </div>
        ) : (
          <p style={metaTextStyle}>등록된 생활 키워드가 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function MatchAnalysisSection({
  detail,
  isFriend,
  friendRequestState,
  friendBusy,
  onFriendAction,
  onViewProfile,
  onMessage,
}: {
  detail: MatchDetail;
  isFriend: boolean;
  friendRequestState: FriendRequestState;
  friendBusy: boolean;
  onFriendAction: () => void;
  onViewProfile: () => void;
  onMessage: () => Promise<void>;
}) {
  const friendButtonLabel = friendBusy
    ? "처리 중…"
    : isFriend
      ? "친구 삭제"
      : friendRequestState === "SENT"
        ? "수락 요청 중"
        : friendRequestState === "RECEIVED"
          ? "받은 요청 확인"
          : "+ 친구 추가";

  const friendButtonDisabled = friendBusy || friendRequestState === "SENT";

  return (
    <section style={analysisSectionStyle}>
      <div style={scoreGridStyle}>
        <ScoreBox icon="♥" label="매칭 점수" value={`${detail.score}%`} />
        <ScoreBox
          icon="✓"
          label="생활 성향 일치"
          value={`${detail.exactMatchCount}/${detail.totalAxisCount}`}
        />
        <ScoreBox
          icon="★"
          label="중요 조건 일치"
          value={`${detail.importantMatchCount}/${detail.totalImportantCount}`}
        />
      </div>
      <div>
        <h3 style={sectionTitleStyle}>왜 잘 맞나요?</h3>
        {detail.reasons.length > 0 ? (
          <div style={{ display: "grid", gap: 11 }}>
            {detail.reasons.map((reason) => (
              <div key={reason} style={reasonRowStyle}>
                <span aria-hidden="true" style={checkIconStyle}>
                  ✓
                </span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={metaTextStyle}>일부 생활 성향에서 공통점이 있습니다.</p>
        )}
      </div>
      {detail.adjustmentPoints.length > 0 && (
        <div style={warningBoxStyle}>
          <h3
            style={{
              ...sectionTitleStyle,
              marginBottom: 9,
              color: "var(--primary)",
            }}
          >
            조율이 필요한 부분
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {detail.adjustmentPoints.map((point) => (
              <div key={point} style={warningRowStyle}>
                <span aria-hidden="true">⚠</span>
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={actionRowStyle}>
        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={onViewProfile}
        >
          공개 프로필 보기
        </button>
        <button
          type="button"
          style={{
            ...secondaryButtonStyle,
            cursor: friendButtonDisabled ? "default" : "pointer",
            opacity: friendButtonDisabled ? 0.65 : 1,
          }}
          disabled={friendButtonDisabled}
          onClick={onFriendAction}
        >
          {friendButtonLabel}
        </button>
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={() => void onMessage()}
        >
          메시지 보내기
        </button>
      </div>
    </section>
  );
}

function ProfilePhoto({
  src,
  color,
  name,
}: {
  src: string | null;
  color: string;
  name: string;
}) {
  if (src) {
    return (
      <img src={src} alt={`${name} 프로필 사진`} style={profileImageStyle} />
    );
  }

  return (
    <div
      aria-label={`${name} 기본 프로필`}
      style={{
        ...profileFallbackStyle,
        background: color || "var(--primary)",
      }}
    >
      {name.charAt(0)}
    </div>
  );
}

function ScoreBox({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div style={scoreBoxStyle}>
      <span
        aria-hidden="true"
        style={{
          color: "var(--primary)",
          fontSize: 18,
        }}
      >
        {icon}
      </span>

      <div>
        <span style={scoreLabelStyle}>{label}</span>

        <strong style={scoreValueStyle}>{value}</strong>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  padding: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(20, 24, 32, 0.44)",
};

const modalStyle: CSSProperties = {
  position: "relative",
  width: "min(960px, 100%)",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
  padding: 28,
  borderRadius: 22,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.18)",
};

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 14,
  right: 16,
  width: 38,
  height: 38,
  border: "none",
  borderRadius: "50%",
  background: "transparent",
  color: "var(--text-2)",
  fontSize: 27,
  cursor: "pointer",
};

const contentGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 28,
};

const profileSectionStyle: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 20,
  paddingRight: 24,
};

const analysisSectionStyle: CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 27,
  paddingTop: 8,
};

const profileImageStyle: CSSProperties = {
  width: "100%",
  maxHeight: 300,
  aspectRatio: "4 / 4.5",
  objectFit: "cover",
  borderRadius: 18,
  background: "var(--bg-2)",
};

const profileFallbackStyle: CSSProperties = {
  width: "100%",
  maxHeight: 300,
  aspectRatio: "4 / 4.5",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 18,
  color: "#fff",
  fontSize: 72,
  fontWeight: 700,
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 16,
  fontWeight: 700,
};

const metaTextStyle: CSSProperties = {
  margin: "5px 0",
  color: "var(--text-2)",
  fontSize: 13.5,
};

const introTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--text)",
  fontSize: 14,
  lineHeight: 1.7,
  whiteSpace: "pre-line",
};

const chipWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 7,
};

const chipStyle: CSSProperties = {
  padding: "6px 11px",
  borderRadius: 99,
  background: "var(--bg-2)",
  color: "var(--primary)",
  fontSize: 12,
  fontWeight: 600,
};

const neutralChipStyle: CSSProperties = {
  ...chipStyle,
  color: "var(--text-2)",
};

const scoreGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const scoreBoxStyle: CSSProperties = {
  minWidth: 0,
  padding: 14,
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: "1px solid var(--border)",
  borderRadius: 14,
};

const scoreLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 4,
  color: "var(--text-2)",
  fontSize: 11.5,
};

const scoreValueStyle: CSSProperties = {
  display: "block",
  color: "var(--text)",
  fontSize: 21,
};

const reasonRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  color: "var(--text)",
  fontSize: 14,
  lineHeight: 1.5,
};

const checkIconStyle: CSSProperties = {
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

const warningBoxStyle: CSSProperties = {
  padding: 17,
  borderRadius: 14,
  border: "1px solid rgba(255, 90, 95, 0.3)",
  background: "rgba(255, 90, 95, 0.08)",
};

const warningRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  color: "var(--primary)",
  fontSize: 13.5,
  lineHeight: 1.5,
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 11,
};

const secondaryButtonStyle: CSSProperties = {
  padding: "13px 17px",
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  flex: "1 1 150px",
};

const primaryButtonStyle: CSSProperties = {
  padding: "13px 17px",
  border: "none",
  borderRadius: 12,
  background: "var(--primary)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  flex: "1 1 180px",
};

const stateMessageStyle: CSSProperties = {
  padding: 70,
  textAlign: "center",
  color: "var(--text-2)",
};
