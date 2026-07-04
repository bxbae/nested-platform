# Nested — Co-living Platform (Next.js App Router)

A full-stack co-living platform demo. Two overlapping circles = shared space.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

## Features

1. **Find a home** (`/browse`) — live search, room-type / vibe / budget filters, sort, and a synced mini-map. Detail pages at `/homes/[id]`.
2. **Roommate match** (`/match`) — a weighted compatibility engine scoring residents on sleep rhythm, tidiness, social energy, shared interests, and lifestyle dealbreakers, with transparent reasons per match.
3. **Community** (`/community`) — house feed with categories (notices, events, chores, market, chat), pinning, and post creation.
4. **Bookings & checkout** (booking widget + `/trips`) — deposit + first month + 5% service fee ledger, simulated payment, reservation management, cancellation.

## Architecture

- **Frontend:** Next.js 14 App Router, React 18, TypeScript, CSS design tokens.
- **Backend:** Next.js Route Handlers under `src/app/api/*` (`houses`, `match`, `posts`, `bookings`).
- **Data:** seed data in `src/lib/data.ts`; in-memory store in `src/lib/store.ts` (swap for Prisma/Postgres behind the same interface for production).
- **Matching logic:** `src/lib/matching.ts`.

## Design system

Palette: paper (#f7f5f0), ink (#1f2420), sage (#5c7457), ochre accent (#b4703b).
Type: Fraunces (display) + Inter (body) + Spline Sans Mono (data).
Signature: the nested-rings mark, reused as logo, score rings, and confirmation.
Respects reduced-motion and keyboard focus throughout.
