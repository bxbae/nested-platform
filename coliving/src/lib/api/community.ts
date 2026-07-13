// ── Community (커뮤니티) service ──────────────────────────────────────
// Reads are public; writing a post or a reply needs a session. In demo mode we
// keep talking to the in-repo /api/posts route so the offline build still works.

import { USE_REAL_API } from "./config";
import { api } from "./client";
import type { Post } from "@/lib/types";

export type ApiCategory = "NOTICE" | "EVENT" | "CHORE" | "MARKET" | "CHAT";

interface ApiAuthor {
  id: string;
  name: string;
}

interface ApiPost {
  id: string;
  roomId: string;
  category: ApiCategory;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  author: ApiAuthor;
  _count?: { comments: number };
}

export interface ApiComment {
  id: string;
  body: string;
  createdAt: string;
  author: ApiAuthor;
}

export interface PostDetail extends Post {
  authorId: string;
  comments: ApiComment[];
}

// Server enum ↔ the lowercase category the UI already uses.
const toUi = (c: ApiCategory) => c.toLowerCase() as Post["category"];
const toApi = (c: string) => c.toUpperCase() as ApiCategory;

function adapt(p: ApiPost): Post {
  return {
    id: p.id,
    houseId: p.roomId,
    author: p.author?.name ?? "알 수 없음",
    category: toUi(p.category),
    title: p.title,
    body: p.body,
    createdAt: p.createdAt,
    replies: p._count?.comments ?? 0,
    pinned: p.pinned,
  };
}

// GET /posts?category=…
export async function listPosts(category = "all"): Promise<Post[]> {
  if (!USE_REAL_API) {
    const res = await fetch(`/api/posts?category=${category}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.posts ?? [];
  }
  try {
    const rows = await api.get<ApiPost[]>(`/posts?category=${encodeURIComponent(category)}`, {
      auth: false,
    });
    return rows.map(adapt);
  } catch {
    return [];
  }
}

// GET /posts/:id — post plus its replies
export async function getPost(id: string): Promise<PostDetail | null> {
  if (!USE_REAL_API) {
    const res = await fetch(`/api/posts?category=all`);
    const data = await res.json();
    const found = (data.posts ?? []).find((p: Post) => p.id === id);
    return found ? { ...found, authorId: "", comments: [] } : null;
  }
  try {
    const p = await api.get<ApiPost & { comments: ApiComment[]; authorId: string }>(
      `/posts/${id}`,
      { auth: false },
    );
    return { ...adapt(p), authorId: p.author.id, comments: p.comments ?? [] };
  } catch {
    return null;
  }
}

// POST /posts
export async function createPost(input: {
  roomId: string;
  category: string;
  title: string;
  body: string;
}): Promise<Post | null> {
  if (!USE_REAL_API) {
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return res.ok ? (await res.json()).post ?? null : null;
  }
  const p = await api.post<ApiPost>("/posts", {
    roomId: input.roomId,
    category: toApi(input.category),
    title: input.title,
    body: input.body,
  });
  return adapt(p);
}

// POST /posts/:id/comments
export async function addComment(postId: string, body: string): Promise<ApiComment> {
  return api.post<ApiComment>(`/posts/${postId}/comments`, { body });
}

// DELETE /posts/comments/:commentId
export async function deleteComment(commentId: string): Promise<void> {
  await api.delete(`/posts/comments/${commentId}`);
}

// DELETE /posts/:id
export async function deletePost(id: string): Promise<void> {
  await api.delete(`/posts/${id}`);
}
