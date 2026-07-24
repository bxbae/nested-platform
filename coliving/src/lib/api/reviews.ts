// ── Reviews (리뷰 관리) service ───────────────────────────────────────
// Host-side: every review across the listings I own, plus the reply endpoint.
// Demo mode keeps the sample reviews so the offline build still renders.

import { USE_REAL_API } from "./config";
import { api } from "./client";
import { hostReviews as demoHostReviews } from "@/lib/host";

interface ApiReview {
  id: string;
  roomId: string;
  rating: number;
  body: string;
  hostReply: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarColor: string | null };
  room: { id: string; name: string };
}

// What the 리뷰 관리 page renders.
export interface HostReview {
  id: string;
  authorId?: string;
  houseId: string;
  houseName: string;
  author: string;
  avatarColor: string;
  rating: number;
  date: string; // "2026.05"
  body: string;
  hostReply: string | null;
}

function adapt(r: ApiReview): HostReview {
  const d = new Date(r.createdAt);
  return {
    id: r.id,
    authorId: r.author?.id,
    houseId: r.room.id,
    houseName: r.room.name.trim(),
    author: r.author?.name ?? "게스트",
    avatarColor: r.author?.avatarColor ?? "#FF5A5F",
    rating: r.rating,
    date: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`,
    body: r.body,
    hostReply: r.hostReply,
  };
}

// GET /reviews/received — reviews on every room I host.
// (예전 경로는 /reviews/mine 이었으나, 그 경로는 "내가 쓴 리뷰"로 넘겼다.)
export async function listHostReviews(): Promise<HostReview[]> {
  if (!USE_REAL_API) {
    return demoHostReviews().map((r, i) => ({
      id: `demo-${i}`,
      houseId: r.houseId,
      houseName: r.houseName,
      author: r.author,
      avatarColor: r.avatarColor,
      rating: r.rating,
      date: r.date,
      body: r.body,
      hostReply: null,
    }));
  }
  try {
    const rows = await api.get<ApiReview[]>("/reviews/received");
    return rows.map(adapt);
  } catch {
    return [];
  }
}

// 내가 작성한 리뷰 (게스트 관점)
export interface MyReview {
  id: string;
  roomId: string;
  roomName: string;
  region: string;
  rating: number;
  body: string;
  date: string;
  hostReply: string | null;
}

// GET /reviews/mine — 로그인한 사용자가 남긴 리뷰 목록
export async function listMyReviews(): Promise<MyReview[]> {
  if (!USE_REAL_API) return [];
  try {
    const rows = await api.get<
      (ApiReview & { room?: { id: string; name: string; region: string } })[]
    >("/reviews/mine");
    return rows.map((r) => {
      const d = new Date(r.createdAt);
      return {
        id: r.id,
        roomId: r.room?.id ?? "",
        roomName: r.room?.name?.trim() ?? "삭제된 숙소",
        region: r.room?.region ?? "",
        rating: r.rating,
        body: r.body,
        date: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`,
        hostReply: r.hostReply ?? null,
      };
    });
  } catch {
    return [];
  }
}

// PATCH /reviews/:id/reply — only the room's host may reply
export async function replyToReview(id: string, hostReply: string): Promise<void> {
  await api.patch(`/reviews/${id}/reply`, { hostReply });
}

// POST /reviews — a signed-in guest leaves a rating + body on a room.
// The server attaches authorId from the JWT, so we only send the content.
// rating must be an integer 1–5; body must be non-empty (validated server-side).
export async function createReview(input: {
  roomId: string;
  rating: number;
  body: string;
}): Promise<void> {
  await api.post("/reviews", input);
}
