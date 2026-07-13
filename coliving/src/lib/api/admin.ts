// ── Admin service ────────────────────────────────────────────────────
// Approval queue for new listings. A room is created with published=false and
// stays out of search until an admin approves it here.

import { api } from "./client";
import { apiRoomToHouse, type ApiRoom } from "./adapters";
import type { House } from "@/lib/types";

export interface PendingListing extends House {
  address: string | null;
  verifiedByHost: boolean;
  hostName: string;
  submittedAt: string;
}

// GET /admin/rooms/pending
export async function listPendingRooms(): Promise<PendingListing[]> {
  const rows = await api.get<
    (ApiRoom & {
      address?: string | null;
      verifiedByHost?: boolean;
      createdAt: string;
      host?: { name?: string };
    })[]
  >("/admin/rooms/pending");

  return rows.map((r) => ({
    ...apiRoomToHouse(r),
    address: r.address ?? null,
    verifiedByHost: r.verifiedByHost ?? false,
    hostName: r.host?.name ?? "호스트",
    submittedAt: r.createdAt,
  }));
}

// PATCH /admin/rooms/:id/publish — makes the listing searchable
export async function publishRoom(id: string, published = true): Promise<void> {
  await api.patch(`/admin/rooms/${id}/publish`, { published });
}

// DELETE /admin/rooms/:id — reject the submission outright
export async function rejectRoom(id: string): Promise<void> {
  await api.delete(`/admin/rooms/${id}`);
}
