// ── 고객센터 문의 ────────────────────────────────────────────────────
// 로그인한 사용자만 문의를 남길 수 있고, 운영팀이 답변하면 알림이 온다.
import { api } from "./client";

export type InquiryStatus = "RECEIVED" | "IN_PROGRESS" | "RESOLVED";

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  RECEIVED: "대기 중",
  IN_PROGRESS: "처리 중",
  RESOLVED: "완료",
};

export interface Inquiry {
  id: string;
  title: string;
  body: string;
  status: InquiryStatus;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
}

export interface AdminInquiry extends Inquiry {
  authorId: string;
  authorName: string;
  authorEmail: string;
}

// POST /inquiries
export async function createInquiry(input: {
  title: string;
  body: string;
}): Promise<Inquiry> {
  return api.post<Inquiry>("/inquiries", input);
}

// GET /inquiries/mine
export async function listMyInquiries(): Promise<Inquiry[]> {
  return api.get<Inquiry[]>("/inquiries/mine");
}

// GET /admin/inquiries?status=
export async function listAllInquiries(
  status?: InquiryStatus,
): Promise<AdminInquiry[]> {
  const query = status ? `?status=${status}` : "";
  return api.get<AdminInquiry[]>(`/admin/inquiries${query}`);
}

// PATCH /admin/inquiries/:id — 답변 저장 또는 상태 변경.
// 답변 본문이 새로 들어갈 때만 문의자에게 알림이 간다.
export async function answerInquiry(
  id: string,
  input: { answer?: string; status?: InquiryStatus },
): Promise<void> {
  await api.patch(`/admin/inquiries/${id}`, input);
}
