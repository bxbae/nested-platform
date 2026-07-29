"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "@/lib/api/useAuth";
import {
  listMyActivity,
  type ApiCategory,
  type MyActivity,
} from "@/lib/api/community";

type ActivityTab =
  | "posts"
  | "comments"
  | "replies";

const EMPTY_ACTIVITY: MyActivity = {
  posts: [],
  comments: [],
  replies: [],
};

const CATEGORY_LABEL: Record<
  ApiCategory,
  string
> = {
  NOTICE: "공지",
  EVENT: "이벤트",
  CHORE: "생활",
  MARKET: "중고거래",
  CHAT: "자유",
  SEEKING: "룸메이트 찾기",
};

const TAB_LABEL: Record<
  ActivityTab,
  string
> = {
  posts: "게시글",
  comments: "댓글",
  replies: "답글",
};

export default function MyActivityPage() {
  const { isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] =
    useState<ActivityTab>("posts");
  const [activity, setActivity] =
    useState<MyActivity>(EMPTY_ACTIVITY);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const tab = new URLSearchParams(
      window.location.search,
    ).get("tab");

    if (
      tab === "posts" ||
      tab === "comments" ||
      tab === "replies"
    ) {
      setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const rows =
          await listMyActivity();

        if (alive) {
          setActivity(rows);
        }
      } catch (loadError) {
        if (!alive) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "내 활동을 불러오지 못했습니다.",
        );
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  const tabs = useMemo(
    () => [
      {
        key: "posts" as const,
        label: "게시글",
        count: activity.posts.length,
      },
      {
        key: "comments" as const,
        label: "댓글",
        count: activity.comments.length,
      },
      {
        key: "replies" as const,
        label: "답글",
        count: activity.replies.length,
      },
    ],
    [activity],
  );

  function changeTab(tab: ActivityTab) {
    setActiveTab(tab);

    const url =
      new URL(window.location.href);

    url.searchParams.set("tab", tab);
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}`,
    );
  }

  const currentCount =
    activity[activeTab].length;

  return (
    <div>
      <h1
        className="display"
        style={{
          fontSize: 30,
          marginBottom: 6,
        }}
      >
        내 활동
      </h1>

      <p
        style={{
          color: "var(--text-2)",
          marginBottom: 20,
        }}
      >
        {loading
          ? "불러오는 중…"
          : `내가 작성한 ${TAB_LABEL[activeTab]} ${currentCount}개`}
      </p>

      <div
        role="tablist"
        aria-label="내 활동 구분"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          borderBottom:
            "1px solid var(--border)",
        }}
      >
        {tabs.map((tab) => {
          const selected =
            activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() =>
                changeTab(tab.key)
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "11px 14px",
                marginBottom: -1,
                border: "none",
                borderBottom: selected
                  ? "2px solid var(--primary)"
                  : "2px solid transparent",
                background: "transparent",
                color: selected
                  ? "var(--primary)"
                  : "var(--text-2)",
                fontSize: 14,
                fontWeight: selected
                  ? 700
                  : 500,
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
                  background: selected
                    ? "rgba(255, 90, 95, 0.12)"
                    : "var(--bg-2)",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {!loading &&
        !isAuthenticated && (
          <div
            className="card"
            style={{
              padding: 32,
              textAlign: "center",
            }}
          >
            <p
              style={{
                color: "var(--text-2)",
                marginBottom: 16,
              }}
            >
              내 활동을 보려면 로그인이 필요해요.
            </p>

            <Link
              href="/?auth=1"
              className="btn btn-primary press"
            >
              로그인
            </Link>
          </div>
        )}

      {error && (
        <div
          className="card"
          style={{
            padding: 28,
            color: "var(--primary)",
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <p
          style={{
            color: "var(--text-2)",
          }}
        >
          활동 내역을 불러오는 중…
        </p>
      )}

      {!loading &&
        isAuthenticated &&
        !error &&
        activeTab === "posts" && (
          <PostActivityList
            items={activity.posts}
          />
        )}

      {!loading &&
        isAuthenticated &&
        !error &&
        activeTab === "comments" && (
          <CommentActivityList
            items={activity.comments}
          />
        )}

      {!loading &&
        isAuthenticated &&
        !error &&
        activeTab === "replies" && (
          <ReplyActivityList
            items={activity.replies}
          />
        )}
    </div>
  );
}

function PostActivityList({
  items,
}: {
  items: MyActivity["posts"];
}) {
  if (items.length === 0) {
    return (
      <EmptyState>
        아직 작성한 게시글이 없어요.
      </EmptyState>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
      }}
    >
      {items.map((post) => (
        <article
          key={post.id}
          className="card"
          style={{
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "flex-start",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                minWidth: 0,
                flex: 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 7,
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: 7,
                }}
              >
                <span className="chip">
                  {CATEGORY_LABEL[
                    post.category
                  ]}
                </span>

                <span
                  style={{
                    color: "var(--text-2)",
                    fontSize: 12,
                  }}
                >
                  댓글 {post.commentCount}개
                </span>
              </div>

              <Link
                href={`/community/${post.id}`}
              >
                <strong
                  style={{
                    fontSize: 16,
                    lineHeight: 1.5,
                  }}
                >
                  {post.title}
                </strong>
              </Link>

              <p
                style={{
                  margin: "8px 0 0",
                  color: "var(--text-2)",
                  fontSize: 12.5,
                }}
              >
                {formatDate(post.createdAt)}
              </p>
            </div>

            <Link
              className="btn btn-ghost"
              href={`/community/${post.id}`}
            >
              게시글 보기
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function CommentActivityList({
  items,
}: {
  items: MyActivity["comments"];
}) {
  if (items.length === 0) {
    return (
      <EmptyState>
        아직 작성한 댓글이 없어요.
      </EmptyState>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
      }}
    >
      {items.map((comment) => (
        <ActivityTextCard
          key={comment.id}
          body={comment.body}
          postId={comment.postId}
          postTitle={comment.postTitle}
          category={comment.postCategory}
          createdAt={comment.createdAt}
          commentId={comment.id}
          actionLabel="댓글 보기"
        />
      ))}
    </div>
  );
}

function ReplyActivityList({
  items,
}: {
  items: MyActivity["replies"];
}) {
  if (items.length === 0) {
    return (
      <EmptyState>
        아직 작성한 답글이 없어요.
      </EmptyState>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
      }}
    >
      {items.map((reply) => (
        <ActivityTextCard
          key={reply.id}
          body={reply.body}
          postId={reply.postId}
          postTitle={reply.postTitle}
          category={reply.postCategory}
          createdAt={reply.createdAt}
          commentId={reply.id}
          actionLabel="답글 보기"
          parentBody={reply.parentBody}
        />
      ))}
    </div>
  );
}

function ActivityTextCard({
  body,
  postId,
  postTitle,
  category,
  createdAt,
  commentId,
  actionLabel,
  parentBody,
}: {
  body: string;
  postId: string;
  postTitle: string;
  category: ApiCategory;
  createdAt: string;
  commentId: string;
  actionLabel: string;
  parentBody?: string | null;
}) {
  const targetUrl =
    `/community/${postId}` +
    `?commentId=${encodeURIComponent(commentId)}`;

  return (
    <article
      className="card"
      style={{
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              flexWrap: "wrap",
              marginBottom: 9,
            }}
          >
            <span className="chip">
              {CATEGORY_LABEL[category]}
            </span>

            <Link
              href={`/community/${postId}`}
              style={{
                color: "var(--text-2)",
                fontSize: 12.5,
              }}
            >
              {postTitle}
            </Link>
          </div>

          {parentBody && (
            <div
              style={{
                marginBottom: 10,
                padding: "9px 11px",
                borderRadius:
                  "var(--r-sm)",
                background: "var(--bg-2)",
                color: "var(--text-2)",
                fontSize: 12.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              원댓글: {parentBody}
            </div>
          )}

          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {body}
          </p>

          <p
            style={{
              margin: "9px 0 0",
              color: "var(--text-2)",
              fontSize: 12.5,
            }}
          >
            {formatDate(createdAt)}
          </p>
        </div>

        <Link
          className="btn btn-ghost"
          href={targetUrl}
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}

function EmptyState({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{
        padding: 40,
        textAlign: "center",
        color: "var(--text-2)",
        border:
          "1px dashed var(--border)",
        background: "transparent",
      }}
    >
      {children}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}
