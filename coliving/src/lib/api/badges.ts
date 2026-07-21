// ── Tenant reviews & badges ──────────────────────────────────────────
// Hosts review tenants after a stay ends; badges are derived from reviews
// received (as a tenant) and reviews written (on rooms).

import { USE_REAL_API } from "./config";
import { api } from "./client";

export interface Badge {
  key: string;
  label: string;
  icon: string;
  description: string;
}

export interface TenantBadges {
  userId: string;
  ratingAverage: number | null;
  ratingCount: number;
  reviewsWritten: number;
  badges: Badge[];
}

const EMPTY: TenantBadges = {
  userId: "",
  ratingAverage: null,
  ratingCount: 0,
  reviewsWritten: 0,
  badges: [],
};

// POST /tenant-reviews/:reservationId — host rates the tenant of a finished stay.
export async function reviewTenant(
  reservationId: string,
  rating: number,
  body: string,
): Promise<void> {
  if (!USE_REAL_API) return;
  await api.post(`/tenant-reviews/${reservationId}`, { rating, body });
}

// GET /me/badges — my own badge summary.
export async function getMyBadges(): Promise<TenantBadges> {
  if (!USE_REAL_API) return EMPTY;
  try {
    return await api.get<TenantBadges>("/me/badges");
  } catch {
    return EMPTY;
  }
}

// GET /users/:id/badges — another user's badges (public).
export async function getUserBadges(userId: string): Promise<TenantBadges> {
  if (!USE_REAL_API) return EMPTY;
  try {
    return await api.get<TenantBadges>(`/users/${userId}/badges`);
  } catch {
    return EMPTY;
  }
}
