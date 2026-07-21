import { api } from "./client";
import type { FriendProfile } from "./friends";

export async function getPublicUserProfile(userId: string): Promise<FriendProfile> {
  return api.get<FriendProfile>(`/friends/users/${encodeURIComponent(userId)}`);
}
