import { api } from "./client";
import type { Preference } from "./preference";

export type FriendRequestState = "NONE" | "SENT" | "RECEIVED";

export interface FriendProfile {
  friendshipId?: string;
  userId: string;
  name: string;
  role: "GUEST" | "HOST" | "ADMIN";

  // 서버가 생년월일에서 계산한 연령대(20/30/40).
  // 정확한 생일은 내려오지 않는다.
  ageGroup: number | null;

  job: string | null;
  bio: string | null;
  intro: string | null;
  keywords: string[];
  avatarColor: string;
  avatarUrl: string | null;
  joinedYear: number;
  verified: boolean;
  tier: "SEED" | "SPROUT" | "REGULAR" | "TRUSTED" | "ELITE";
  tierLabel: string;

  // 사용자가 생활 성향 설문을 완료한 경우에만 공개한다.
  lifestyle: Preference | null;

  friendsSince?: string;
  isFriend?: boolean;
  isMe?: boolean;

  // 공개 프로필 및 친구 상태 API에서 사용한다.
  friendRequestState?: FriendRequestState;
  friendRequestId?: string | null;
}

export interface FriendStatus {
  isFriend: boolean;
  friendshipId: string | null;
  createdAt: string | null;
  requestState: FriendRequestState;
  requestId: string | null;
}

export interface AddFriendResult {
  isFriend: boolean;
  requestState: FriendRequestState;
  requestId: string | null;
}

export interface IncomingFriendRequest {
  requestId: string;
  createdAt: string;
  userId: string;
  name: string;
  role: "GUEST" | "HOST" | "ADMIN";
  ageGroup: number | null;
  job: string | null;
  avatarColor: string;
  avatarUrl: string | null;
}

export interface AcceptFriendRequestResult {
  accepted: boolean;
  isFriend: boolean;
}

export interface RejectFriendRequestResult {
  rejected: boolean;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | null;
}

export async function listFriends(): Promise<FriendProfile[]> {
  return api.get<FriendProfile[]>("/friends");
}

export async function listIncomingFriendRequests(): Promise<
  IncomingFriendRequest[]
> {
  return api.get<IncomingFriendRequest[]>("/friends/requests/incoming");
}

export async function getFriendStatus(
  targetUserId: string,
): Promise<FriendStatus> {
  return api.get<FriendStatus>(
    `/friends/status/${encodeURIComponent(targetUserId)}`,
  );
}

export async function addFriend(
  targetUserId: string,
): Promise<AddFriendResult> {
  return api.post<AddFriendResult>(
    `/friends/${encodeURIComponent(targetUserId)}`,
  );
}

export async function acceptFriendRequest(
  requestId: string,
): Promise<AcceptFriendRequestResult> {
  return api.post<AcceptFriendRequestResult>(
    `/friends/requests/${encodeURIComponent(requestId)}/accept`,
  );
}

export async function rejectFriendRequest(
  requestId: string,
): Promise<RejectFriendRequestResult> {
  return api.post<RejectFriendRequestResult>(
    `/friends/requests/${encodeURIComponent(requestId)}/reject`,
  );
}

export async function removeFriend(
  targetUserId: string,
): Promise<{ removed: boolean }> {
  return api.delete(`/friends/${encodeURIComponent(targetUserId)}`);
}
