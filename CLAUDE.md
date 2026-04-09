# CLAUDE.md — GetawayNow Service Marketplace

This file gives Claude context about the codebase so it can assist effectively without re-exploring the entire repo on every task.

## Documentation Map

| Doc | Purpose | When to read |
|---|---|---|
| `CLAUDE.md` (this file) | Architecture, rules, quick reference | Auto-loaded every session |
| `BEST_PRACTICES.md` | Detailed coding standards with examples | **MANDATORY** — before writing any code |
| `LESSONS.md` | Hard-won fixes from past debugging sessions | **Before debugging** — check if this problem was solved before |
| `knowledge.md` | ADRs, tech stack decisions, API contract log | When asking "why did we choose X?" |
| `TODO.md` | Post-M2 carry-forward items | Before starting M3 work |
| `Milestones.md` | Full 16-week milestone breakdown | For scope/timeline reference |

No other guideline files exist. `BEST_PRACTICES.md` is the single authority for import order, type conventions, styling rules, and testing standards.

**IMPORTANT — After every PR:** Before finishing, ask the user whether `knowledge.md` needs updating. Any new ADR, dependency addition, API endpoint, or architectural decision made during the PR must be logged there. `knowledge.md` must never go stale.

---

## MANDATORY: Read Before Writing Any Code

**`BEST_PRACTICES.md` is non-negotiable.** Read it and apply every rule to every file you touch — without being asked. Key rules:

1. **Import order** — React → React ecosystem (RN/Expo/Next/NestJS) → third-party → local (`@repo/*` then `~/`). Blank line between each group.
2. **Types** — Never hand-write domain entity types. Always `z.infer<typeof Schema>` from `@repo/schemas`.
3. **No hardcoded colors or fonts** — only Tailwind theme tokens (`text-primary`, `bg-background`, `font-heading`). Never `text-[#hex]` or `style={{ color: '...' }}`.
4. **Tests** — every new NestJS service method and controller gets a `.spec.ts` test. No untested backend features.
5. **No `any`, no `@ts-ignore`, no `console.log`** in committed code.
6. **Error boundaries** — every user-facing async action handler must have a top-level try-catch. No unhandled promise rejections. Use `reportError()` + `showToast()`, not `console.error` + `Alert.alert`. See §11–13.
7. **SDK wrappers** — never call Clerk/Stripe methods directly from UI. Use safe wrappers from `@repo/utils`. See §12.
8. **Request-ID** — all API calls include `X-Request-ID`. Backend logs include `[rid:...]`. See §13.

---

## What This Project Is

Multi-sided service marketplace. Turborepo monorepo. 16-week timeline.

- **`apps/api`** — NestJS 11 REST API + Socket.io (port 3001)
- **`apps/mobile`** — Expo SDK 54, Expo Router v6, single app with role-based navigation
- **`apps/web`** — Next.js 15 App Router admin dashboard (port 3000)
- **`packages/schemas`** — Zod schemas: SINGLE SOURCE OF TRUTH for all types
- **`packages/api-client`** — TanStack Query v5 hooks + Axios
- **`packages/hooks`** — platform-agnostic logic, no JSX
- **`packages/ui`** — NativeWind v4 cross-platform primitives, no business logic
- **`packages/utils`** — currency, date, geo
- **`packages/config`** — shared ESLint, TS, Tailwind configs

---

## Key Architectural Rules

### Types
- NEVER manually declare types for domain entities. Always use `z.infer<typeof SomeSchema>`.
- All Zod schemas live in `packages/schemas`. Import from `@repo/schemas` everywhere else.

### Package Boundaries
- `packages/*` must not import from `apps/*`
- `apps/*` may import from `packages/*` but never from sibling apps
- `packages/ui` — presentational only
- `packages/hooks` and `packages/api-client` — no JSX

### Auth
- Clerk owns auth entirely. No passwords, no custom auth flows.
- Role stored in `publicMetadata.role`: `CUSTOMER | PROVIDER | ADMIN`
- API uses `ClerkAuthGuard` (`apps/api/src/auth/clerk.guard.ts`) — validates Clerk JWT in `Authorization: Bearer`
- Clerk webhook → `POST /api/v1/auth/webhook` → Prisma upserts `User`
- **Clerk SDK methods can throw raw `Error` despite TypeScript signatures claiming `{ error }` return.** Always wrap Clerk calls in try-catch. See `BEST_PRACTICES.md` §11 and §12.

### Error Handling & Observability
- **"Log silently, alert loudly."** Every catch block must report to the error reporting utility — never silently swallow.
- **Mobile**: Sentry for production crash/error tracking. Toast for recoverable errors, Alert only for "action required."
- **Backend**: NestJS `Logger` with Request-ID context. Every service method that calls external APIs or does multi-step writes must log failures with the correlation ID.
- **Request-ID flow**: Mobile generates UUID per request → `X-Request-ID` header → NestJS middleware extracts and attaches to logger context → response includes same header → Sentry breadcrumbs reference it.
- **Third-party SDK wrappers**: Clerk, Stripe, and any SDK with unreliable error contracts must be called through safe wrapper utilities — never directly from UI components. See `BEST_PRACTICES.md` §12.
- **Toast libraries**: `react-native-toast-message` (mobile), `sonner` (web). Both accessed through `packages/ui` shared toast utility — swap libraries in one place.

### API Conventions
- All routes: `/api/v1/<resource>`
- DTOs validated via `ZodValidationPipe` (nestjs-zod), schemas from `@repo/schemas`
- Module pattern per domain: `<domain>.module.ts`, `.controller.ts`, `.service.ts`, `.gateway.ts`
- Socket events: `domain:action` (e.g. `booking:status_changed`)

### S3
- Never return raw S3 keys to clients. Always presigned URLs (GET: 1hr, PUT: 15min).
- Bucket layout: `provider-documents/<userId>/`, `service-photos/<providerId>/<serviceId>/`, `avatars/<userId>/`

### Database
- Prisma 6 + PostgreSQL 16
- Local: Docker on port 5434 (`docker compose up -d`)
- After ANY schema change: `pnpm db:generate` (regenerate client) — skipping this causes cryptic type errors
- Table names use snake_case (`@@map` directive on every model)

---

## Common Gotchas (hard-learned)

- **Prisma client out of date** — always run `pnpm db:generate` after changing `schema.prisma`. This is the #1 cause of mysterious type errors.
- **NativeWind v4 babel** — must have `nativewind/babel` in `babel.config.js` for mobile. Do not upgrade to v5 without testing.
- **Expo Router redirect loops** — check that `_layout.tsx` only redirects when auth state is fully resolved (not during loading).
- **Clerk webhook URL** — must be the ngrok HTTPS URL pointing to port 3001, not localhost.
- **Role-select race condition** — after setting role via Clerk Admin SDK, wait for session refresh before redirecting. The Clerk session doesn't update synchronously.
- **Clerk SDK throws despite typed returns** — `signIn.finalize()`, `signUp.finalize()`, and other Clerk methods throw raw `Error` internally when preconditions aren't met, even though TypeScript types say they return `{ error }`. Always wrap in try-catch. See LESSONS.md for details.
- **Web `.env`** — Next.js needs `NEXT_PUBLIC_*` prefix for client-side vars; backend Clerk secret goes in `.env.local` (not committed).
- **Clerk v3 API breaking changes** — `@clerk/backend` v3 changed several helper signatures. Check the official v3 migration guide before using examples from older blog posts.
- **`pnpm --filter` for scoped commands** — to run Prisma commands: `pnpm --filter @repo/api db:push` (or use root aliases in `package.json`).
- **`svix` for webhook verification** — used in `webhook.controller.ts` to verify the `svix-signature` header. Do not skip this check.

---

## Exact Versions to Know

| Key dependency | Version |
|---|---|
| pnpm | 9.15.0 |
| TypeScript | 5.6.x |
| NestJS | 11.x |
| Prisma | 6.x |
| Expo SDK | 54 |
| Expo Router | 6.x |
| React Native | 0.81.5 |
| React (mobile) | 19.1.0 |
| React (web) | 18.3.1 |
| NativeWind | 4.x |
| Next.js | 15.x |
| Clerk (mobile) | `@clerk/expo` ^3.1.5 |
| Clerk (web) | `@clerk/nextjs` ^7.0.5 |
| Clerk (api) | `@clerk/backend` ^3.0.1 |
| TanStack Query | 5.x |
| Stripe SDK | 20.x |
| Socket.io | 4.x |
| Zod | 3.x |
| nestjs-zod | 5.x |
| Turbo | 2.x |

---

## Database Schema (Quick Reference)

Models: `User`, `ProviderProfile`, `ProviderDocument`, `ServiceCategory`, `Service`, `Booking`, `Payment`, `Conversation`, `Message`, `Review`

Booking status flow: `PENDING → ACCEPTED → IN_PROGRESS → COMPLETED` (or `REJECTED` / `CANCELLED`)

Full schema: `apps/api/prisma/schema.prisma`

---

## Useful File Locations

| What | Where |
|---|---|
| Prisma schema | `apps/api/prisma/schema.prisma` |
| NestJS entry | `apps/api/src/main.ts` |
| Clerk guard | `apps/api/src/auth/clerk.guard.ts` |
| Clerk webhook | `apps/api/src/auth/webhook.controller.ts` |
| Mobile root layout | `apps/mobile/src/app/_layout.tsx` |
| Mobile role-select | `apps/mobile/src/app/(auth)/role-select.tsx` |
| Zod schemas | `packages/schemas/src/` |
| API client hooks | `packages/api-client/src/` |
| API client (Axios) | `packages/api-client/src/client.ts` |
| Error reporting util | `packages/utils/src/error-reporting.ts` |
| Toast utility | `packages/ui/src/toast.tsx` |
| Request-ID middleware | `apps/api/src/common/request-id.middleware.ts` |
| Docker compose | `docker-compose.yml` |
| Env examples | `apps/api/.env.example`, `apps/mobile/.env.example` |

---

## Feature Development Sequence

Every new feature follows this order. Do not skip steps.

```
1. Zod Schema    → packages/schemas/src/<entity>.schema.ts
2. Service       → apps/api/src/<domain>/<domain>.service.ts (log with requestId)
3. Controller    → apps/api/src/<domain>/<domain>.controller.ts
4. Tests         → .spec.ts files next to service + controller
5. API Client    → packages/api-client/src/ (TanStack Query hook)
6. Screen / UI   → apps/mobile/src/app/ or apps/web/src/app/
                   (try-catch on every action handler, reportError + showToast)
```

DTOs are validated via `ZodValidationPipe` + schemas from `@repo/schemas`. No `class-validator`.

---

## Milestones

| M | Weeks | Status |
|---|---|---|
| M1 | 1–3 | Foundation, Auth, base structure ✅ |
| M2 | 4–7 | Customer App — discovery, booking ✅ (PR#4 merged 2026-04-08) |
| M3 | 8–10 | Provider App — jobs, availability, earnings + error handling & observability (Sentry, Request-ID, Toast) |
| M4 | 11–13 | Payments, Messaging, Real-time |
| M5 | 14–16 | Admin Dashboard, Testing, Launch |

### M2 Delivered
- Provider discovery + map view, provider profiles with ratings/services
- End-to-end booking flows (create, status tracking, history)
- Favorites, notifications, reviews
- Real-time booking updates via WebSocket (`booking.gateway.ts`, `chat.gateway.ts`)
- Scoped provider service categories
- Full backend test coverage (22 spec files)
- See `TODO.md` for minor carry-forward items (none are M3 blockers except WebSocket CORS for production)
