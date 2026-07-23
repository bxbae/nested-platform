"use client";

import { useSyncExternalStore, useCallback } from "react";
import { authStore, type AuthUser } from "./auth-store";
import {
  login as loginApi,
  register as registerApi,
  logout as logoutApi,
  startOAuth,
  type OAuthProvider,
} from "./auth";

// React binding over the framework-agnostic authStore. Re-renders on
// login/logout via useSyncExternalStore (no extra state library needed).
export function useAuth() {
  const user = useSyncExternalStore<AuthUser | null>(
    authStore.subscribe,
    () => authStore.getUser(),
    () => null, // SSR snapshot — no tokens on the server
  );

  const login = useCallback(
    (email: string, password: string) => loginApi(email, password),
    [],
  );
  const register = useCallback(
    (
      email: string,
      password: string,
      name: string,
      gender: "MALE" | "FEMALE" | "OTHER",
      preferredLocale: "KO" | "EN",
    ) => registerApi(email, password, name, gender, preferredLocale),
    [],
  );
  const logout = useCallback(() => logoutApi(), []);
  const oauth = useCallback(
    (provider: OAuthProvider) => startOAuth(provider),
    [],
  );

  return {
    user,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    oauth,
  };
}
