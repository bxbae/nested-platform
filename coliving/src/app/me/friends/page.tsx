"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { UserAvatar } from "@/components/UserAvatar";
import { UserBadges } from "@/components/UserBadges";
import {
  acceptFriendRequest,
  listFriends,
  listIncomingFriendRequests,
  rejectFriendRequest,
  removeFriend,
  type FriendProfile,
  type IncomingFriendRequest,
} from "@/lib/api/friends";
import { openDirectConversation } from "@/lib/api/messages";

type FriendsTab = "FRIENDS" | "REQUESTS";

export default function FriendsPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<FriendsTab>("FRIENDS");

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [requests, setRequests] = useState<IncomingFriendRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [targetRequestId, setTargetRequestId] = useState<string | null>(null);
  const [highlightedRequestId, setHighlightedRequestId] = useState<
    string | null
  >(null);

  const handledTargetRef = useRef<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const [friendRows, requestRows] = await Promise.all([
        listFriends(),
        listIncomingFriendRequests(),
      ]);

      setFriends(friendRows);
      setRequests(requestRows);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "친구 정보를 불러오지 못했어요.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const tab = params.get("tab");
    const requestId = params.get("requestId");

    if (tab === "requests" || requestId) {
      setActiveTab("REQUESTS");
    }

    setTargetRequestId(requestId);
    void loadAll();
  }, []);

  useEffect(() => {
    if (
      loading ||
      !targetRequestId ||
      handledTargetRef.current === targetRequestId
    ) {
      return;
    }

    const request = requests.find((item) => item.requestId === targetRequestId);

    if (!request) {
      return;
    }

    handledTargetRef.current = targetRequestId;
    setActiveTab("REQUESTS");
    setHighlightedRequestId(request.requestId);

    const scrollTimer = window.setTimeout(() => {
      document
        .getElementById(`friend-request-${request.requestId}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 150);

    const highlightTimer = window.setTimeout(() => {
      setHighlightedRequestId(null);
    }, 3000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [loading, requests, targetRequestId]);

  const tabItems = useMemo(
    () => [
      {
        key: "FRIENDS" as const,
        label: "친구 목록",
        count: friends.length,
      },
      {
        key: "REQUESTS" as const,
        label: "받은 요청",
        count: requests.length,
      },
    ],
    [friends.length, requests.length],
  );

  async function message(userId: string) {
    setBusyUserId(userId);
    setError(null);

    try {
      const room = await openDirectConversation(userId);

      router.push(`/me/messages?direct=${encodeURIComponent(room.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "메시지 화면을 열지 못했어요.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function remove(userId: string) {
    setBusyUserId(userId);
    setError(null);
    setNotice(null);

    try {
      await removeFriend(userId);

      setFriends((current) => current.filter((item) => item.userId !== userId));

      setNotice("친구 목록에서 삭제했습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "친구를 삭제하지 못했어요.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function accept(request: IncomingFriendRequest) {
    setBusyRequestId(request.requestId);
    setError(null);
    setNotice(null);

    try {
      await acceptFriendRequest(request.requestId);

      const [friendRows, requestRows] = await Promise.all([
        listFriends(),
        listIncomingFriendRequests(),
      ]);

      setFriends(friendRows);
      setRequests(requestRows);
      setActiveTab("FRIENDS");
      setNotice(`${request.name}님과 친구가 되었습니다.`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "친구 요청을 수락하지 못했어요.",
      );
    } finally {
      setBusyRequestId(null);
    }
  }

  async function reject(request: IncomingFriendRequest) {
    setBusyRequestId(request.requestId);
    setError(null);
    setNotice(null);

    try {
      await rejectFriendRequest(request.requestId);

      setRequests((current) =>
        current.filter((item) => item.requestId !== request.requestId),
      );

      setNotice(`${request.name}님의 친구 요청을 거절했습니다.`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "친구 요청을 거절하지 못했어요.",
      );
    } finally {
      setBusyRequestId(null);
    }
  }

  return (
    <div>
      <h1
        className="display"
        style={{
          fontSize: 30,
          marginBottom: 6,
        }}
      >
        친구 관리
      </h1>

      <p
        style={{
          color: "var(--text-2)",
          marginBottom: 18,
        }}
      >
        친구 목록과 받은 친구 요청을 관리합니다.
      </p>

      <div
        role="tablist"
        aria-label="친구 관리 탭"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setError(null);
              setNotice(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "11px 14px",
              marginBottom: -1,
              border: "none",
              borderBottom:
                activeTab === tab.key
                  ? "2px solid var(--primary)"
                  : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab.key ? "var(--primary)" : "var(--text-2)",
              fontSize: 14,
              fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {tab.label}

            <span
              style={{
                minWidth: 21,
                height: 21,
                padding: "0 6px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  activeTab === tab.key
                    ? "rgba(255, 90, 95, 0.12)"
                    : "var(--bg-2)",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p
          style={{
            fontSize: 13,
            color: "var(--primary)",
            marginBottom: 12,
          }}
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          style={{
            fontSize: 13,
            color: "var(--secondary)",
            marginBottom: 12,
          }}
        >
          {notice}
        </p>
      )}

      {loading ? (
        <p style={{ color: "var(--text-2)" }}>불러오는 중…</p>
      ) : activeTab === "FRIENDS" ? (
        <FriendsList
          items={friends}
          busyUserId={busyUserId}
          onMessage={message}
          onRemove={remove}
        />
      ) : (
        <RequestList
          items={requests}
          busyRequestId={busyRequestId}
          highlightedRequestId={highlightedRequestId}
          onAccept={accept}
          onReject={reject}
        />
      )}
    </div>
  );
}

function FriendsList({
  items,
  busyUserId,
  onMessage,
  onRemove,
}: {
  items: FriendProfile[];
  busyUserId: string | null;
  onMessage: (userId: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}) {
  if (items.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--text-2)",
        }}
      >
        아직 등록된 친구가 없습니다.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
      }}
    >
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

            <div
              style={{
                flex: 1,
                minWidth: 220,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  flexWrap: "wrap",
                }}
              >
                <strong>{friend.name}</strong>

                <UserBadges
                  verified={friend.verified}
                  tier={friend.tier}
                  tierLabel={friend.tierLabel}
                />
              </div>

              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--text-2)",
                  marginTop: 3,
                }}
              >
                {[
                  friend.ageGroup ? `${friend.ageGroup}대` : null,
                  friend.role === "HOST"
                    ? "호스트"
                    : friend.role === "ADMIN"
                      ? "관리자"
                      : "게스트",
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
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    marginTop: 8,
                  }}
                >
                  {friend.keywords.slice(0, 3).map((keyword) => (
                    <span
                      key={keyword}
                      className="chip"
                      style={{
                        fontSize: 11,
                        padding: "5px 9px",
                      }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Link
                className="btn btn-ghost"
                href={`/users/${encodeURIComponent(friend.userId)}`}
              >
                프로필 보기
              </Link>

              <button
                type="button"
                className="btn btn-primary"
                disabled={isBusy}
                onClick={() => void onMessage(friend.userId)}
              >
                {isBusy ? "처리 중…" : "메시지"}
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                disabled={isBusy}
                onClick={() => void onRemove(friend.userId)}
              >
                삭제
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RequestList({
  items,
  busyRequestId,
  highlightedRequestId,
  onAccept,
  onReject,
}: {
  items: IncomingFriendRequest[];
  busyRequestId: string | null;
  highlightedRequestId: string | null;
  onAccept: (request: IncomingFriendRequest) => Promise<void>;
  onReject: (request: IncomingFriendRequest) => Promise<void>;
}) {
  if (items.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--text-2)",
        }}
      >
        받은 친구 요청이 없습니다.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
      }}
    >
      {items.map((request) => {
        const isBusy = busyRequestId === request.requestId;

        const highlighted = highlightedRequestId === request.requestId;

        return (
          <article
            id={`friend-request-${request.requestId}`}
            key={request.requestId}
            className="card"
            style={{
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 15,
              flexWrap: "wrap",
              outline: highlighted
                ? "2px solid var(--primary)"
                : "2px solid transparent",
              outlineOffset: 2,
              boxShadow: highlighted
                ? "0 8px 28px rgba(0, 0, 0, 0.12)"
                : undefined,
              transition: "outline-color 0.25s ease, box-shadow 0.25s ease",
            }}
          >
            <UserAvatar
              name={request.name}
              avatarUrl={request.avatarUrl}
              avatarColor={request.avatarColor}
              size={56}
            />

            <div
              style={{
                flex: 1,
                minWidth: 220,
              }}
            >
              <strong>{request.name}</strong>

              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--text-2)",
                  marginTop: 4,
                }}
              >
                {[
                  request.ageGroup ? `${request.ageGroup}대` : null,
                  request.role === "HOST"
                    ? "호스트"
                    : request.role === "ADMIN"
                      ? "관리자"
                      : "게스트",
                  request.job,
                ]
                  .filter(Boolean)
                  .join(" · ") || "프로필 정보 없음"}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  marginTop: 7,
                }}
              >
                {new Date(request.createdAt).toLocaleString("ko-KR")}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Link
                className="btn btn-ghost"
                href={`/users/${encodeURIComponent(request.userId)}`}
              >
                프로필 보기
              </Link>

              <button
                type="button"
                className="btn btn-primary"
                disabled={isBusy}
                onClick={() => void onAccept(request)}
              >
                {isBusy ? "처리 중…" : "수락"}
              </button>

              <button
                type="button"
                className="btn btn-ghost"
                disabled={isBusy}
                onClick={() => void onReject(request)}
              >
                거절
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
