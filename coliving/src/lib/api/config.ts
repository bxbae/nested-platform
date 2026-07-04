// ── Backend connection config ───────────────────────────────────────
// Single source of truth for whether the app talks to the real NestJS API
// (nested-mono/apps/api) or the in-repo demo Route Handlers under /api/*.
//
// Toggle via env (see .env.local.example):
//   NEXT_PUBLIC_USE_REAL_API=true         → hit the NestJS server
//   NEXT_PUBLIC_API_URL=http://localhost:4000
//
// When USE_REAL_API is false, every adapter falls back to the demo /api
// routes, so the app runs with zero backend — the presentation demo path.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

export const USE_REAL_API = process.env.NEXT_PUBLIC_USE_REAL_API === "true";

// Socket.io endpoint for the /chat namespace. Defaults to the API origin.
export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") ?? API_BASE_URL;
