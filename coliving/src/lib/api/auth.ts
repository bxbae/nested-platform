// ── Auth service ────────────────────────────────────────────────────
// Wraps the NestJS /auth endpoints and keeps the token store in sync.
// OAuth (Google/Kakao/Naver/Apple) is a browser redirect to the API, which
// returns { accessToken, refreshToken, user } — see completeOAuth().

import { API_BASE_URL, USE_REAL_API } from "./config";
import { api } from "./client";
import { authStore, type AuthTokens, type AuthUser } from "./auth-store";

// In demo mode (no backend) we fabricate a local session so the login UI is
// fully clickable on the portfolio deployment. Tokens are dummy strings — the
// app never calls a real API in this mode.
function demoTokens(email: string, name?: string): AuthTokens {
  return {
    accessToken: "demo-access",
    refreshToken: "demo-refresh",
    user: {
      id: "demo-user",
      email,
      role: "USER",
      name: name ?? email.split("@")[0],
    },
  };
}

export async function register(email: string, password: string, name: string): Promise<AuthUser> {
  if (!USE_REAL_API) {
    const t = demoTokens(email, name);
    authStore.set(t);
    return t.user;
  }
  const res = await api.post<AuthTokens>("/auth/register", { email, password, name }, { auth: false });
  authStore.set(res);
  return res.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  if (!USE_REAL_API) {
    const t = demoTokens(email);
    authStore.set(t);
    return t.user;
  }
  const res = await api.post<AuthTokens>("/auth/login", { email, password }, { auth: false });
  authStore.set(res);
  return res.user;
}

export function logout() {
  authStore.clear();
}

// Re-fetch the current user (validates the access token, refreshing if stale).
export async function fetchMe(): Promise<AuthUser | null> {
  if (!USE_REAL_API || !authStore.isAuthenticated()) return authStore.getUser();
  try {
    const me = await api.get<ApiMe>("/auth/me");
    const user = toAuthUser(me);
    const current = authStore.get();
    if (current) authStore.set({ ...current, user });
    return user;
  } catch {
    return null;
  }
}

interface ApiMe {
  sub?: string;
  id?: string;
  email: string;
  role: string;
  name?: string | null;
  bio?: string | null;
  avatarColor?: string;
  hasPassword?: boolean;
  createdAt?: string | null;
}

function toAuthUser(me: ApiMe): AuthUser {
  return {
    id: me.id ?? me.sub ?? "",
    email: me.email,
    role: me.role,
    name: me.name ?? undefined,
    bio: me.bio ?? null,
    avatarColor: me.avatarColor,
    hasPassword: me.hasPassword,
    createdAt: me.createdAt ?? null,
  };
}

// PATCH /auth/me — update own profile. Email and role are not accepted by the
// API, so they can't be changed here.
export async function updateProfile(data: {
  name?: string;
  bio?: string;
  avatarColor?: string;
}): Promise<AuthUser> {
  const me = await api.patch<ApiMe>("/auth/me", data);
  const user = toAuthUser(me);
  // Keep the store in sync so the header/sidebar update immediately.
  const current = authStore.get();
  if (current) authStore.set({ ...current, user });
  return user;
}

// POST /auth/change-password — the API verifies the current password and
// revokes existing refresh tokens on success.
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.post("/auth/change-password", { currentPassword, newPassword });
}

export type OAuthProvider = "google" | "kakao" | "naver" | "apple";

// Kick off an OAuth flow by navigating to the API's provider route.
export function startOAuth(provider: OAuthProvider) {
  window.location.href = `${API_BASE_URL}/auth/${provider}`;
}

// If the OAuth callback hands tokens back via the redirect (query/hash),
// call this on the landing page to store them.
export function completeOAuth(tokens: AuthTokens) {
  authStore.set(tokens);
}
