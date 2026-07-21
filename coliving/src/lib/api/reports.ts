// ── Reports (신고) service ────────────────────────────────────────────
// 사용자가 메시지 등을 신고할 때 쓰는 API. 신고 접수 후에는
// /admin/reports 화면(관리자)에서 처리 상태를 관리한다.

import { api } from "./client";

export type ReportTargetType = "ROOM" | "REVIEW" | "USER" | "MESSAGE";

// POST /reports — targetType별로 재사용 가능하지만, 지금은 채팅 메시지
// 신고(신고 버튼 → 팝업)에서만 사용한다.
export async function createReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<void> {
  await api.post("/reports", { targetType, targetId, reason });
}

// 채팅 메시지 신고 전용 헬퍼.
export async function reportMessage(messageId: string, reason: string): Promise<void> {
  await createReport("MESSAGE", messageId, reason);
}
