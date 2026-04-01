# CLAUDE.md — GetawayNow Service Marketplace

This file gives Claude context about the codebase so it can assist effectively without re-exploring the entire repo on every task.

## MANDATORY: Read Before Writing Any Code

**`BEST_PRACTICES.md` is non-negotiable.** Read it and apply every rule to every file you touch — without being asked. Key rules:

1. **Import order** — React → React ecosystem (RN/Expo/Next/NestJS) → third-party → local (`@repo/*` then `~/`). Blank line between each group.
2. **Types** — Never hand-write domain entity types. Always `z.infer<typeof Schema>` from `@repo/schemas`.
3. **No hardcoded colors or fonts** — only Tailwind theme tokens (`text-primary`, `bg-background`, `font-heading`). Never `text-[#hex]` or `style={{ color: '...' }}`.
4. **Tests** — every new NestJS service method and controller gets a `.spec.ts` test. No untested backend features.
5. **No `any`, no `@ts-ignore`, no `console.log`** in committed code.

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
| Docker compose | `docker-compose.yml` |
| Env examples | `apps/api/.env.example`, `apps/mobile/.env.example` |

---

## Milestones

| M | Weeks | Status |
|---|---|---|
| M1 | 1–3 | Foundation, Auth, base structure ✅ |
| M2 | 4–7 | Customer App — discovery, booking |
| M3 | 8–10 | Provider App — jobs, availability, earnings |
| M4 | 11–13 | Payments, Messaging, Real-time |
| M5 | 14–16 | Admin Dashboard, Testing, Launch |
