import { api } from "./client";

export type ReportTargetType = "ROOM" | "REVIEW" | "USER" | "MESSAGE" | "COMMUNITY_POST" | "COMMUNITY_COMMENT";
export async function createReport(targetType: ReportTargetType, targetId: string, reason: string): Promise<void> { await api.post("/reports", { targetType, targetId, reason }); }
export const reportMessage = (id: string, reason: string) => createReport("MESSAGE", id, reason);
export const reportReview = (id: string, reason: string) => createReport("REVIEW", id, reason);
export const reportCommunityPost = (id: string, reason: string) => createReport("COMMUNITY_POST", id, reason);
export const reportCommunityComment = (id: string, reason: string) => createReport("COMMUNITY_COMMENT", id, reason);
