// ── Notifications service ────────────────────────────────────────────
// Talks to the JWT-guarded /notifications endpoints. In demo mode there's no
// account, so we fall back to the sample notifications used by the offline
// portfolio build.

import { USE_REAL_API } from "./config";
import { api } from "./client";
import { notifications as demoNotifications } from "@/lib/me";

export type NotificationType =
  | "COMMENT"
  | "ROOM_APPROVED"
  | "ROOM_REJECTED"
  | "RESERVATION_REQUESTED"
  | "RESERVATION_CONFIRMED"
  | "RESERVATION_COMPLETED"
  | "RESERVATION_CANCELLED"
  | "EARLY_CHECKOUT_REQUESTED"
  | "EARLY_CHECKOUT_APPROVED"
  | "EARLY_CHECKOUT_REJECTED"
  | "PAYMENT"
  | "REVIEW"
  | "SYSTEM"
  | "MESSAGE"
  | "RESERVATION";

export interface ApiNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  targetUrl: string | null;
}

export const TYPE_LABEL: Record<NotificationType, string> = {
  COMMENT: "댓글",
  ROOM_APPROVED: "숙소 승인",
  ROOM_REJECTED: "숙소 반려",
  RESERVATION_REQUESTED: "예약 요청",
  RESERVATION_CONFIRMED: "예약 확정",
  RESERVATION_COMPLETED: "이용 완료",
  RESERVATION_CANCELLED: "예약 취소",
  EARLY_CHECKOUT_REQUESTED: "조기 퇴실 요청",
  EARLY_CHECKOUT_APPROVED: "조기 퇴실 승인",
  EARLY_CHECKOUT_REJECTED: "조기 퇴실 거절",
  PAYMENT: "결제",
  REVIEW: "리뷰",
  SYSTEM: "안내",
  MESSAGE: "메시지",
  RESERVATION: "예약",
};

export const TYPE_COLOR: Record<NotificationType, string> = {
  COMMENT: "#2E9D65",
  ROOM_APPROVED: "#7C6FE0",
  ROOM_REJECTED: "#A26A42",
  RESERVATION_REQUESTED: "#00A699",
  RESERVATION_CONFIRMED: "#00A699",
  RESERVATION_COMPLETED: "#00A699",
  RESERVATION_CANCELLED: "#00A699",
  EARLY_CHECKOUT_REQUESTED: "#00A699",
  EARLY_CHECKOUT_APPROVED: "#00A699",
  EARLY_CHECKOUT_REJECTED: "#00A699",
  PAYMENT: "#3E9BC4",
  REVIEW: "#FFB400",
  SYSTEM: "#7C6FE0",
  MESSAGE: "#FF5A5F",
  RESERVATION: "#00A699",
};

// "3분 전" / "2시간 전" / "5일 전"
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

// GET /notifications → { items, unread }
export async function listNotifications(): Promise<{
  items: ApiNotification[];
  unread: number;
}> {
  if (!USE_REAL_API) {
    const demo = demoNotifications();
    const byLabel: Record<string, NotificationType> = {
      예약: "RESERVATION",
      결제: "PAYMENT",
      메시지: "MESSAGE",
      리뷰: "REVIEW",
      시스템: "SYSTEM",
    };
    return {
      items: demo.map((n) => ({
        id: String(n.id),
        type: byLabel[n.type] ?? "SYSTEM",
        title: n.title,
        body: n.body ?? "",
        read: !n.unread,
        createdAt: new Date().toISOString(),
        targetUrl: null,
      })),
      unread: demo.filter((n) => n.unread).length,
    };
  }
  try {
    return await api.get<{ items: ApiNotification[]; unread: number }>(
      "/notifications",
    );
  } catch {
    return { items: [], unread: 0 };
  }
}

// Just the badge number — used by the My page quick cards.
export async function unreadNotificationCount(): Promise<number> {
  const { unread } = await listNotifications();
  return unread;
}

// PATCH /notifications/:id/read
export async function markNotificationRead(id: string): Promise<void> {
  if (!USE_REAL_API) return;
  await api.patch(`/notifications/${id}/read`);
}

// PATCH /notifications/read-all
export async function markAllNotificationsRead(): Promise<void> {
  if (!USE_REAL_API) return;
  await api.patch("/notifications/read-all");
}

export async function unreadMessageNotificationCount(): Promise<number> {
  if (!USE_REAL_API) {
    const result = await listNotifications();
    return result.items.filter((item) => item.type === "MESSAGE" && !item.read)
      .length;
  }
  try {
    const result = await api.get<{ unread: number }>(
      "/notifications/messages/unread-count",
    );
    return result.unread;
  } catch {
    return 0;
  }
}
