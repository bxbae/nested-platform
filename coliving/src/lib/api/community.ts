import { USE_REAL_API } from "./config";
import { api } from "./client";
import type { Post } from "@/lib/types";

export type ApiCategory =
  | "NOTICE"
  | "EVENT"
  | "CHORE"
  | "MARKET"
  | "CHAT"
  | "SEEKING";

export type PostStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED";

export interface ApiAuthor {
  id: string;
  name: string;
  avatarColor?: string | null;
  avatarUrl?: string | null;
}

export interface ApiComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string | null;
  author: ApiAuthor;
  replies?: ApiComment[];
}

interface ApiPost {
  id: string;
  roomId: string;
  category: ApiCategory;
  status: PostStatus;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt?: string;
  author: ApiAuthor;
  lifestyleSnapshot?: Record<string, unknown> | null;
  sharedLifestyleFields?: string[];
  _count?: {
    comments: number;
  };
  comments?: ApiComment[];
}

export interface PostDetail extends Post {
  authorId: string;
  status: PostStatus;
  comments: ApiComment[];
  lifestyleSnapshot: Record<string, unknown> | null;
  sharedLifestyleFields: string[];
}

export interface MyActivityPost {
  id: string;
  title: string;
  category: ApiCategory;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
}

export interface MyActivityComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  postId: string;
  postTitle: string;
  postCategory: ApiCategory;
}

export interface MyActivityReply
  extends MyActivityComment {
  parentCommentId: string | null;
  parentBody: string | null;
}

export interface MyActivity {
  posts: MyActivityPost[];
  comments: MyActivityComment[];
  replies: MyActivityReply[];
}

const toUi = (
  category: ApiCategory,
): Post["category"] =>
  category.toLowerCase() as Post["category"];

const toApi = (
  category: string,
): ApiCategory =>
  category.toUpperCase() as ApiCategory;

function adapt(post: ApiPost): Post {
  return {
    id: post.id,
    houseId: post.roomId,
    author:
      post.author?.name ?? "알 수 없음",
    authorId: post.author?.id,
    authorAvatarColor:
      post.author?.avatarColor ?? null,
    authorAvatarUrl:
      post.author?.avatarUrl ?? null,
    category: toUi(post.category),
    title: post.title,
    body: post.body,
    createdAt: post.createdAt,
    replies:
      post._count?.comments ?? 0,
    pinned: post.pinned,
  };
}

export async function listPosts(
  category = "all",
  q = "",
  status = "all",
): Promise<Post[]> {
  const keyword = q.trim();

  if (!USE_REAL_API) {
    const response = await fetch(
      `/api/posts?category=${category}`,
    );

    if (!response.ok) {
      return [];
    }

    let rows: Post[] =
      (await response.json()).posts ?? [];

    if (keyword) {
      const normalized =
        keyword.toLowerCase();

      rows = rows.filter(
        (row) =>
          row.title
            .toLowerCase()
            .includes(normalized) ||
          row.body
            .toLowerCase()
            .includes(normalized),
      );
    }

    return rows;
  }

  try {
    const params =
      new URLSearchParams({
        category,
        status,
      });

    if (keyword) {
      params.set("q", keyword);
    }

    const rows =
      await api.get<ApiPost[]>(
        `/posts?${params}`,
        {
          auth: false,
        },
      );

    return rows.map(adapt);
  } catch {
    return [];
  }
}

export async function getPost(
  id: string,
): Promise<PostDetail | null> {
  if (!USE_REAL_API) {
    return null;
  }

  try {
    const post =
      await api.get<ApiPost>(
        `/posts/${id}`,
        {
          auth: false,
        },
      );

    return {
      ...adapt(post),
      authorId: post.author.id,
      status: post.status,
      comments: post.comments ?? [],
      lifestyleSnapshot:
        post.lifestyleSnapshot ?? null,
      sharedLifestyleFields:
        post.sharedLifestyleFields ?? [],
    };
  } catch {
    return null;
  }
}

export async function listMyActivity(): Promise<MyActivity> {
  if (!USE_REAL_API) {
    return {
      posts: [],
      comments: [],
      replies: [],
    };
  }

  return api.get<MyActivity>(
    "/posts/me/activity",
  );
}

export async function createPost(input: {
  roomId: string;
  category: string;
  title: string;
  body: string;
  status?: PostStatus;
  sharedLifestyleFields?: string[];
}): Promise<Post | null> {
  if (!USE_REAL_API) {
    return null;
  }

  const post =
    await api.post<ApiPost>("/posts", {
      ...input,
      category: toApi(input.category),
    });

  return adapt(post);
}

export const addComment = (
  postId: string,
  body: string,
  parentId?: string,
) =>
  api.post<ApiComment>(
    `/posts/${postId}/comments`,
    {
      body,
      parentId,
    },
  );

export const updateComment = (
  id: string,
  body: string,
) =>
  api.patch<ApiComment>(
    `/posts/comments/${id}`,
    {
      body,
    },
  );

export async function deleteComment(
  id: string,
) {
  await api.delete(
    `/posts/comments/${id}`,
  );
}

export async function updatePost(
  id: string,
  input: {
    category?: string;
    title?: string;
    body?: string;
    status?: PostStatus;
  },
) {
  await api.patch(
    `/posts/${id}`,
    input.category
      ? {
          ...input,
          category: toApi(input.category),
        }
      : input,
  );
}

export async function deletePost(
  id: string,
) {
  await api.delete(`/posts/${id}`);
}
