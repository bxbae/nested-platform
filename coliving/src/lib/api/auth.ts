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
      name: name ?? `사용자${Math.random().toString(36).slice(2, 8)}`,
      nicknameCompleted: Boolean(name?.trim()),
    },
  };
}

// Register can resolve two ways now:
//   • { user }            — logged in immediately (demo mode, or no mail provider)
//   • { verificationRequired } — a verification email was sent; NOT logged in
export type RegisterResult =
  | { user: AuthUser }
  | { verificationRequired: true; email: string; message: string };

export async function register(
  email: string,
  password: string,
  name: string,
  gender: "MALE" | "FEMALE" | "OTHER",
): Promise<RegisterResult> {
  if (!USE_REAL_API) {
    const t = demoTokens(email, name);
    authStore.set(t);
    return { user: t.user };
  }
  const res = await api.post<
    AuthTokens | { verificationRequired: true; email: string; message: string }
  >("/auth/register", { email, password, name, gender }, { auth: false });

  if ("verificationRequired" in res) {
    // No session yet — the caller shows a "check your email" state.
    return res;
  }
  authStore.set(res);
  return { user: res.user };
}

// POST /auth/verify-email — consume the emailed token, log the user in.
export async function verifyEmail(token: string): Promise<AuthUser> {
  const res = await api.post<AuthTokens>("/auth/verify-email", { token }, { auth: false });
  authStore.set(res);
  return res.user;
}

// POST /auth/resend-verification — always resolves (no account enumeration).
export async function resendVerification(email: string): Promise<void> {
  await api.post("/auth/resend-verification", { email }, { auth: false });
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
  nicknameCompleted?: boolean;
  bio?: string | null;
  avatarColor?: string;
  avatarUrl?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER";
  birthDate?: string | null;
  hasPassword?: boolean;
  createdAt?: string | null;
}

function toAuthUser(me: ApiMe): AuthUser {
  return {
    id: me.id ?? me.sub ?? "",
    email: me.email,
    role: me.role,
    name: me.name ?? undefined,
    nicknameCompleted: me.nicknameCompleted ?? true,
    bio: me.bio ?? null,
    avatarColor: me.avatarColor,
    avatarUrl: me.avatarUrl ?? null,
    gender: me.gender ?? "OTHER",
    birthDate: me.birthDate ?? null,
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
  avatarUrl?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER";
  // YYYY-MM-DD 또는 ISO 문자열. null이면 생년월일을 지운다.
  birthDate?: string | null;
}): Promise<AuthUser> {
  const me = await api.patch<ApiMe>("/auth/me", data);
  const user = toAuthUser(me);
  // Keep the store in sync so the header/sidebar update immediately.
  const current = authStore.get();
  if (current) authStore.set({ ...current, user });
  return user;
}

// POST /auth/forgot-password — always resolves, even for an unknown address.
// The API deliberately gives no signal about whether the email is registered.
export async function forgotPassword(email: string): Promise<void> {
  await api.post("/auth/forgot-password", { email }, { auth: false });
}

// POST /auth/reset-password — consumes the token from the emailed link.
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post("/auth/reset-password", { token, newPassword }, { auth: false });
}

// DELETE /auth/me — soft-delete own account. Clears local auth on success so
// the app drops to a logged-out state.
// POST /auth/become-host — 게스트 → 호스트 전환.
// The API returns a fresh token pair because guards read the role from the JWT;
// storing it here means the user can list a room without logging in again.
export async function becomeHost(): Promise<AuthUser> {
  const res = await api.post<AuthTokens>("/auth/become-host");
  authStore.set(res);
  return res.user;
}

export async function deleteAccount(): Promise<void> {
  await api.delete("/auth/me");
  logout();
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
