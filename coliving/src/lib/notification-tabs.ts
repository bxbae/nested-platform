import type {
  ApiNotification,
  NotificationType,
} from "@/lib/api/notifications";

export type NotificationTab =
  | "ALL"
  | "RESERVATION"
  | "ROOM"
  | "PAYMENT_REVIEW"
  | "OTHER";

export const NOTIFICATION_TABS: {
  key: NotificationTab;
  label: string;
}[] = [
  { key: "ALL", label: "전체" },
  { key: "RESERVATION", label: "예약" },
  { key: "ROOM", label: "숙소" },
  { key: "PAYMENT_REVIEW", label: "결제·리뷰" },
  { key: "OTHER", label: "커뮤니티·기타" },
];

const RESERVATION_TYPES = new Set<NotificationType>([
  "RESERVATION",
  "RESERVATION_REQUESTED",
  "RESERVATION_CONFIRMED",
  "RESERVATION_COMPLETED",
  "RESERVATION_CANCELLED",
  "EARLY_CHECKOUT_REQUESTED",
  "EARLY_CHECKOUT_APPROVED",
  "EARLY_CHECKOUT_REJECTED",
]);

const ROOM_TYPES = new Set<NotificationType>([
  "ROOM_APPROVED",
  "ROOM_REJECTED",
]);

export function getNotificationCategory(
  notification: Pick<ApiNotification, "type" | "targetUrl">,
): Exclude<NotificationTab, "ALL"> {
  if (RESERVATION_TYPES.has(notification.type)) {
    return "RESERVATION";
  }

  if (ROOM_TYPES.has(notification.type)) {
    return "ROOM";
  }

  if (notification.type === "PAYMENT" || notification.type === "REVIEW") {
    return "PAYMENT_REVIEW";
  }

  // SYSTEM 타입으로 저장된 알림은 이동 경로를 기준으로 재분류한다.
  if (notification.type === "SYSTEM") {
    const targetUrl = notification.targetUrl ?? "";

    if (
      targetUrl.startsWith("/me/trips") ||
      targetUrl.startsWith("/host/reservations")
    ) {
      return "RESERVATION";
    }

    if (
      targetUrl.startsWith("/admin/approvals") ||
      targetUrl.startsWith("/host/listings")
    ) {
      return "ROOM";
    }

    if (
      targetUrl.startsWith("/me/payments") ||
      targetUrl.startsWith("/me/reviews")
    ) {
      return "PAYMENT_REVIEW";
    }
  }

  return "OTHER";
}

export function matchesNotificationTab(
  notification: ApiNotification,
  tab: NotificationTab,
): boolean {
  return tab === "ALL" || getNotificationCategory(notification) === tab;
}
