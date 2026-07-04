# Nested — monorepo (partial build)

Implements three slices of the [architecture reference](../ARCHITECTURE.md):

## `packages/ui` — Atomic Design component library (shadcn-based)

Design tokens + atoms + molecules, built on Radix primitives and `class-variance-authority`,
themed with the fixed brand palette (coral `#FF5A5F` / teal `#00A699`) via CSS variables and a
shared Tailwind preset. Dark mode, WCAG AA focus rings, and reduced-motion are built in.

- **Tokens** — `src/tokens/globals.css` (CSS vars, light + dark) and `tailwind-preset.ts`.
- **Atoms** — Button, Input, Textarea, Label, Badge, Chip, Avatar, Skeleton, Spinner, Divider,
  IconButton, Rating, Switch, Tooltip.
- **Molecules** — SearchBar, PriceTag, FilterChip, MessageBubble (with read receipts),
  Tabs, Accordion, Dropdown, Breadcrumb, Pagination, StatCard, EmptyState.
- Verify: `cd packages/ui && npm install && npx tsc --noEmit`.
- Visual gallery: `cd showcase && npm install && npm run dev`.

## `apps/api` — NestJS reservations module

- **`pricing.ts`** — pure, tested price engine. `dueNow` = deposit + first month + cleaning +
  one month maintenance + 5% service fee − coupon discount; plus full `contractTotal`.
- **`reservations.service.ts`** — `quote` (no write), `create` (PENDING_PAYMENT hold with
  overlap rejection), `confirmPayment` (server-side PSP verification).
- **`prisma-reservation.repo.ts`** — overlap check + insert inside one **Serializable**
  transaction (double-booking prevention).
- **`psp-payment.gateway.ts`** — server-side verification against Toss / PortOne / Stripe;
  never trusts the client's success claim, always re-checks the paid amount.
- **DTOs** — Zod schemas + a `ZodValidationPipe`.
- Run tests: `cd apps/api && npm install && npx jest` → **17 passing**.

### Booking flow (3-click, quote is the price authority)

```
POST /reservations/quote   → price preview (no write)
POST /reservations         → PENDING_PAYMENT hold  (409 if dates overlap)
POST /payments/confirm     → PSP-verify amount → CONFIRMED  (idempotent)
```

The client renders `/quote` and never computes totals for submission; `/reservations` recomputes
server-side, and `/payments/confirm` rejects any amount that doesn't match both the stored total
and the amount the PSP reports as actually paid.

## What's stubbed vs. real

Real and tested: pricing math, availability/overlap logic, payment-verification control flow,
all component types and composition. Stubbed for the reference build: the live `PrismaService`
(the repo has a guarded stub) and real PSP network calls (the gateway has the exact request shapes;
supply secret keys via env to go live).
