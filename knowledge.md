# Knowledge Log — GetawayNow Service Marketplace

> Living record of architectural decisions, dependency choices, and API contract changes. Every decision that affects the platform structure MUST be logged here.

---

## Tech Stack (Updated — Post-M2)

| Layer | Tech | Version | Reason |
|---|---|---|---|
| API | NestJS | 11.x | Modular, native SWC, TypeScript-first |
| API | TypeScript | 5.6.x | Strict mode, Prisma + Zod integration |
| API | Prisma | 6.x | Type-safe ORM, schema-first migrations |
| API | PostgreSQL | 16 | PRD-specified |
| API | Socket.io | 4.x | Real-time booking + chat via NestJS gateways |
| API | Stripe SDK | 20.x | Stripe Connect for payments + provider payouts |
| API | AWS SDK v3 | 3.x | S3 file storage for provider docs + photos |
| API | nestjs-zod | 5.x | DTO validation via Zod schemas (replaces class-validator) |
| API | svix | latest | Clerk webhook signature verification |
| Mobile | Expo SDK | 54 | Managed workflow, OTA updates |
| Mobile | React Native | 0.81.5 | Paired with Expo 54 |
| Mobile | React | 19.1.0 | Latest stable |
| Mobile | Expo Router | 6.x | File-based routing, role-based route groups |
| Mobile | Clerk (`@clerk/expo`) | ^3.1.5 | Auth: Email/Phone/Google/Apple |
| Mobile | TanStack Query | 5.x | Server state management (replaced Zustand for server state) |
| Mobile | Axios | 1.x | HTTP client with JWT interceptor |
| Mobile | Zod | 3.x | Shared validation schemas from `@repo/schemas` |
| Mobile | NativeWind | 4.x | Tailwind CSS for React Native |
| Mobile | Socket.io client | 4.x | Real-time events |
| Web | Next.js | 15.x | App Router, admin dashboard |
| Web | React | 18.3.1 | Stable for Next.js 15 |
| Web | Clerk (`@clerk/nextjs`) | ^7.0.5 | Same Clerk tenant, admin role check |
| Web | Tailwind CSS | 3.4.x | Utility-first styling |
| Shared | Turborepo | 2.x | Monorepo orchestration |
| Shared | pnpm | 9.15.0 | Workspace package manager |
| Shared | Zod | 3.x | Single source of truth for all types (`@repo/schemas`) |

---

## Monorepo Structure

```
marketplace/
  apps/
    api/          — NestJS 11 REST API + Socket.io (port 3001)
    mobile/       — Expo SDK 54, Expo Router v6, role-based navigation
    web/          — Next.js 15 App Router admin dashboard (port 3000)
  packages/
    schemas/      — Zod schemas: SINGLE SOURCE OF TRUTH for all types
    api-client/   — TanStack Query v5 hooks + Axios
    hooks/        — Platform-agnostic logic, no JSX
    ui/           — NativeWind v4 cross-platform primitives
    utils/        — Currency, date, geo helpers
    config/       — Shared ESLint, TS, Tailwind configs
```

---

## Architectural Decisions

### ADR-001 — One Codebase, Role-Based App Separation
- **Date:** 2026-03-25
- **Decision:** Single Expo codebase (`apps/mobile`) for both Customer and Provider. Route groups `(customer)/` and `(provider)/` in Expo Router. Role stored in Clerk `publicMetadata.role`.
- **Rejected:** Two separate RN repos — doubles maintenance, shared components need a package.
- **Consequence:** Role must be set during onboarding before tab navigation renders.

### ADR-002 — Clerk as Auth Provider (No Custom Auth Server)
- **Date:** 2026-03-25
- **Decision:** Clerk issues JWTs. Backend verifies via JWKS. No custom token issuance.
- **Rejected:** Firebase Auth, Auth0, rolling JWTs in NestJS.
- **Consequence:** Auth handled by `ClerkAuthGuard` (`apps/api/src/auth/clerk.guard.ts`). Provider `approved` flag in Prisma is the secondary gate.

### ADR-003 — Prisma 6 over TypeORM
- **Date:** 2026-03-25
- **Decision:** Prisma 6 for all database access. Schema-first, type-safe, declarative migrations.
- **Rejected:** TypeORM — migration bugs, weak TS inference on relations.
- **Consequence:** All DB queries via generated Prisma client. `PrismaService` singleton in `apps/api/src/prisma/`.

### ADR-004 — Provider Approval Gate
- **Date:** 2026-03-25
- **Decision:** Provider has `role: "PROVIDER"` in Clerk from signup but `approved = false` in Prisma until admin approves. `BookingsController` checks `approved` server-side.
- **Consequence:** `ProviderDocument` model tracks uploaded ID docs. Admin reviews via presigned S3 URLs.

### ADR-005 — S3 Upload Security Model
- **Date:** 2026-03-25
- **Decision:** Provider docs in private S3 prefix. AES256 server-side encryption. Raw S3 URL never returned — always presigned URLs.
- **Consequence:** `@aws-sdk/s3-request-presigner` required. Upload validation (MIME + size) server-side before S3 write.

### ADR-006 — Next.js 15 Admin Dashboard
- **Date:** 2026-03-25 (revised from Vite)
- **Decision:** Next.js 15 App Router for admin. SSR capabilities for future SEO pages, consistent React ecosystem.
- **Revised from:** Vite 6 + React 18 (original plan). Switched during M1 to leverage App Router and shared Clerk integration.

### ADR-007 — Zod as Single Source of Truth for Types
- **Date:** 2026-03-25
- **Decision:** All domain entity types derived from Zod schemas in `packages/schemas`. Never hand-write domain `type` or `interface`. Use `z.infer<typeof Schema>`. DTOs validated via `nestjs-zod` + `ZodValidationPipe`.
- **Rejected:** `class-validator` + manual interfaces (original plan). Zod provides runtime validation + static types from one definition.
- **Consequence:** `packages/schemas` is a dependency of all apps. No `class-validator` in the codebase.

### ADR-008 — Turborepo Monorepo
- **Date:** 2026-03-25
- **Decision:** Single Turborepo monorepo instead of separate repos per project.
- **Consequence:** Shared packages (`@repo/*`), unified CI, workspace-level commands via `pnpm --filter`.

### ADR-009 — Error Handling & Observability Architecture
- **Date:** 2026-04-09
- **Decision:** Centralized error reporting via `reportError()` (`@repo/utils`). Sentry for production crash tracking. Structured dev console logging. Toast for recoverable errors (not Alert). Safe SDK wrappers for third-party APIs with dishonest error contracts (Clerk, Stripe).
- **Rejected:** Per-screen ad-hoc error handling with `Alert.alert` everywhere. No observability beyond console.log.
- **Consequence:** Every user-facing async handler must have top-level try-catch with `reportError()` + `showToast()`. See `BEST_PRACTICES.md` §11-12.

### ADR-010 — Request-ID Correlation for End-to-End Tracing
- **Date:** 2026-04-09
- **Decision:** Mobile/web Axios interceptor generates UUID per request → `X-Request-ID` header → NestJS `RequestIdMiddleware` extracts/generates, attaches to `req.requestId`, echoes in response → Sentry breadcrumbs reference it. Backend services log with `[rid:<requestId>]`.
- **Rejected:** No correlation IDs (status quo). Server-only trace IDs (loses client context).
- **Consequence:** `packages/api-client/src/client.ts` has request/response interceptors. `apps/api/src/common/request-id.middleware.ts` applied globally. Services should include `requestId` in error log calls.

### ADR-011 — Toast Library Selection
- **Date:** 2026-04-09
- **Decision:** `react-native-toast-message` for mobile, `sonner` for web. Both wrapped behind `showToast()` in `packages/ui/src/toast.tsx` so the library can be swapped in one place.
- **Rejected:** Building a custom toast from scratch (unnecessary), using `Alert.alert` for everything (bad UX for recoverable errors).
- **Consequence:** `showToast()` is the only way to show toasts. `Alert.alert` reserved for "action required" scenarios (session expired, destructive confirmation).

---

## API Contract Log

> Updated whenever an endpoint is added, changed, or removed.

| Method | Path | Role | Description | Added |
|---|---|---|---|---|
| POST | `/api/v1/auth/webhook` | Public | Clerk webhook → user upsert | M1 |
| GET | `/api/v1/users/me` | Any | Get current user profile | M1 |
| PATCH | `/api/v1/users/me` | Any | Update current user profile | M1 |
| POST | `/api/v1/uploads/verification-doc` | PROVIDER | Upload ID document to S3 | M1 |
| POST | `/api/v1/uploads/provider-photo` | PROVIDER | Upload service/profile photo | M1 |
| GET | `/api/v1/providers` | CUSTOMER | List/search nearby providers | M2 |
| GET | `/api/v1/providers/:id` | Any | Get provider profile + services | M2 |
| POST | `/api/v1/bookings` | CUSTOMER | Create a booking | M2 |
| GET | `/api/v1/bookings` | Any | List user's bookings | M2 |
| GET | `/api/v1/bookings/:id` | Any | Get booking detail | M2 |
| PATCH | `/api/v1/bookings/:id/status` | Any | Update booking status | M2 |
| POST | `/api/v1/favorites` | CUSTOMER | Add favorite provider | M2 |
| GET | `/api/v1/favorites` | CUSTOMER | List favorite providers | M2 |
| DELETE | `/api/v1/favorites/:id` | CUSTOMER | Remove favorite | M2 |
| POST | `/api/v1/reviews` | CUSTOMER | Submit a review | M2 |
| GET | `/api/v1/reviews/provider/:id` | Any | Get provider reviews | M2 |
| GET | `/api/v1/notifications` | Any | List user notifications | M2 |
| PATCH | `/api/v1/notifications/:id/read` | Any | Mark notification read | M2 |

---

## Dependency Change Log

| Date | Package | Version | Reason |
|---|---|---|---|
| 2026-03-25 | `@aws-sdk/s3-request-presigner` | ^3.x | Presigned URL generation |
| 2026-03-25 | `expo-document-picker` | ~12.x | Provider ID doc upload |
| 2026-04-01 | `nestjs-zod` | 5.x | Replaced class-validator for DTO validation |
| 2026-04-01 | `@repo/schemas` | workspace | Shared Zod schemas package |

---

## Open Questions / To Resolve

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Push notification provider: Expo Push vs FCM/APNs direct? | Waji | Open |
| 2 | Stripe Connect account type: Express vs Standard for providers? | Waji | Open |
| 3 | Google Maps API key management: one key or separate per platform? | Waji | Open |
| 4 | WebSocket CORS lockdown strategy before production (see TODO.md) | Waji | Open — blocker for deploy |
