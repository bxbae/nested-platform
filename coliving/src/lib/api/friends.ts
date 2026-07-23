import { api } from "./client";

export interface FriendProfile {
  userId: string;
  name: string;
  // 서버가 생년월일에서 계산한 연령대(20/30/40). 정확한 생일은 내려오지 않는다.
  ageGroup: number | null;
  job: string | null;
  bio: string | null;
  intro: string | null;
  keywords: string[];
  avatarColor: string;
  avatarUrl: string | null;
  joinedYear: number;
  verified: boolean;
  tier: "SEED" | "REGULAR" | "TRUSTED";
  tierLabel: string;
  friendsSince?: string;
  isFriend?: boolean;
  isMe?: boolean;
}

export async function listFriends(): Promise<FriendProfile[]> {
  return api.get<FriendProfile[]>("/friends");
}

export async function getFriendStatus(targetUserId: string): Promise<{ isFriend: boolean }> {
  return api.get(`/friends/status/${encodeURIComponent(targetUserId)}`);
}

export async function addFriend(targetUserId: string): Promise<{ isFriend: boolean }> {
  return api.post(`/friends/${encodeURIComponent(targetUserId)}`);
}

export async function removeFriend(targetUserId: string): Promise<{ removed: boolean }> {
  return api.delete(`/friends/${encodeURIComponent(targetUserId)}`);
}
