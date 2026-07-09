// ── Favorites (찜) service ───────────────────────────────────────────
// Talks to the NestJS /favorites endpoints (JWT-guarded). In demo mode there's
// no real account, so these fall back to no-ops / the demo wishlist so the UI
// stays clickable on the portfolio build.

import { USE_REAL_API } from "./config";
import { api } from "./client";
import { apiRoomToHouse, type ApiRoom } from "./adapters";
import { wishlist as demoWishlist } from "@/lib/me";
import type { House } from "@/lib/types";

interface ApiFavorite {
  id: string;
  roomId: string;
  room: ApiRoom;
}

// GET /favorites → House[]
export async function listFavorites(): Promise<House[]> {
  if (!USE_REAL_API) return demoWishlist();
  try {
    const rows = await api.get<ApiFavorite[]>("/favorites");
    return rows.map((f) => apiRoomToHouse(f.room));
  } catch {
    return [];
  }
}

// GET /favorites → just the room ids (for marking hearts as active)
export async function listFavoriteIds(): Promise<string[]> {
  if (!USE_REAL_API) return [];
  try {
    const rows = await api.get<ApiFavorite[]>("/favorites");
    return rows.map((f) => f.roomId);
  } catch {
    return [];
  }
}

// POST /favorites { roomId }
export async function addFavorite(roomId: string): Promise<void> {
  if (!USE_REAL_API) return;
  await api.post("/favorites", { roomId });
}

// DELETE /favorites/:roomId
export async function removeFavorite(roomId: string): Promise<void> {
  if (!USE_REAL_API) return;
  await api.delete(`/favorites/${roomId}`);
}
