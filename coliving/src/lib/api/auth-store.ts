// ── Auth token store ────────────────────────────────────────────────
// Holds the JWT access/refresh pair issued by the NestJS /auth endpoints.
// Kept in memory for the request path (fast, no re-read) and mirrored to
// localStorage so a page reload stays logged in.
//
// This is deliberately not a React hook so the plain fetch client can read
// tokens synchronously. A tiny subscribe() lets React components re-render
// on login/logout without pulling in a state library.

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string;
  bio?: string | null;
  avatarColor?: string;
  avatarUrl?: string | null;
  // false for social-login accounts, which have no password to change.
  hasPassword?: boolean;
  createdAt?: string | null;
  // Trust badges (see common/activity-tier on the API side).
  verified?: boolean;
  tier?: "SEED" | "REGULAR" | "TRUSTED";
  tierLabel?: string;
  completedStays?: number;
  reviewsWritten?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const STORAGE_KEY = "nested.auth";

let tokens: AuthTokens | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function load(): AuthTokens | null {
  if (loaded) return tokens;
  loaded = true;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    tokens = raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    tokens = null;
  }
  return tokens;
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    if (tokens) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / quota — stay in-memory only */
  }
}

function emit() {
  listeners.forEach((fn) => fn());
}

export const authStore = {
  get(): AuthTokens | null {
    return load();
  },
  getAccessToken(): string | null {
    return load()?.accessToken ?? null;
  },
  getRefreshToken(): string | null {
    return load()?.refreshToken ?? null;
  },
  getUser(): AuthUser | null {
    return load()?.user ?? null;
  },
  isAuthenticated(): boolean {
    return !!load()?.accessToken;
  },
  set(next: AuthTokens) {
    tokens = next;
    loaded = true;
    persist();
    emit();
  },
  // Update only the token pair after a refresh (user identity unchanged).
  updateTokens(accessToken: string, refreshToken: string) {
    if (!tokens) return;
    tokens = { ...tokens, accessToken, refreshToken };
    persist();
    emit();
  },
  clear() {
    tokens = null;
    loaded = true;
    persist();
    emit();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
