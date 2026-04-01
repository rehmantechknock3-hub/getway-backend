# Milestone 1 — Completion Report
**Project:** Mobile Car Cleaning Marketplace Platform
**Milestone:** M1 — Project Setup & Platform Foundation
**Timeline:** Week 1 – Week 3
**Report Date:** 26 March 2026
**Prepared by:** Development Team

---

## Executive Summary

Milestone 1 has been completed in full as defined in the agreed milestone scope. All five M1 deliverables have been implemented, verified, and are in a working state:

1. Platform foundation (tooling, environment)
2. Database schema and infrastructure
3. User account system (registration, login, role selection)
4. Base mobile app structure (Customer and Provider navigators)
5. Base admin dashboard structure

This report documents every item built, the exact files and decisions made, and explicitly identifies what is intentionally deferred to later milestones. It is structured so it can be compared line-by-line against the PRD and M1 milestone scope.

---

## 1. Platform Foundation

### 1.1 Monorepo Structure

The entire platform is organised as a **Turborepo monorepo** using `pnpm` workspaces. This gives us a single repository with shared packages, unified tooling commands, and deterministic dependency resolution across all three apps.

**Repository layout:**
```
marketplace/
├── apps/
│   ├── api/          ← NestJS backend REST API + WebSocket
│   ├── mobile/       ← Expo React Native app (Customer + Provider, role-based)
│   └── web/          ← Next.js 15 Admin Dashboard
├── packages/
│   ├── schemas/      ← @repo/schemas   — Zod schemas, single source of truth for all types
│   ├── api-client/   ← @repo/api-client — TanStack Query hooks + typed Axios client
│   ├── hooks/        ← @repo/hooks     — Shared business logic hooks (platform-agnostic)
│   ├── ui/           ← @repo/ui        — NativeWind cross-platform UI primitives
│   ├── utils/        ← @repo/utils     — Currency, date, geo utilities
│   └── config/       ← @repo/config    — Shared ESLint, TypeScript, Tailwind configs
├── turbo.json
├── pnpm-workspace.yaml
├── docker-compose.yml
└── CONTRIBUTING.md
```

**Turbo task pipeline** (`turbo.json`) covers:
| Command | Description |
|---|---|
| `turbo run dev` | Start all apps in parallel dev mode |
| `turbo run build` | Build all apps and packages (dependency-ordered) |
| `turbo run type-check` | `tsc --noEmit` across entire monorepo |
| `turbo run lint` | ESLint across all packages |
| `turbo run test` | Vitest across all packages |
| `turbo run db:push` | Push Prisma schema to dev DB |
| `turbo run db:generate` | Regenerate Prisma client |
| `turbo run db:migrate` | Create and apply a named Prisma migration |
| `turbo run db:migrate:deploy` | Apply pending migrations (for CI / production) |
| `turbo run db:studio` | Open Prisma Studio |

### 1.2 Shared Packages

All packages enforce strict boundaries:
- `packages/*` never import from `apps/*`
- `apps/*` import from `packages/*` only, never from other apps

**`@repo/schemas`** — Zod schemas are the canonical type definition. TypeScript types are always inferred (`z.infer<typeof Schema>`), never hand-written. Any schema change immediately surfaces type errors across all apps.

**`@repo/api-client`** — Contains the shared Axios instance and TanStack Query hooks. All HTTP calls in mobile and web go through this package.

**`@repo/ui`** — NativeWind v4 cross-platform component primitives (Button, Card, Badge). Presentational only — no business logic or API calls.

**`@repo/hooks`** — Platform-agnostic hooks (auth, booking tracking, location). No JSX.

**`@repo/utils`** — Shared currency formatting, date utilities, geo-distance helpers.

**`@repo/config`** — Shared ESLint, Tailwind, and TypeScript configurations to ensure consistency.

### 1.3 Environment Configuration

All three apps have `.env.example` files committed to the repository. No secrets are ever committed. Actual `.env` files are gitignored.

**`apps/api/.env.example`**
```
PORT=
WEB_URL=
SOCKET_CORS_ORIGIN=
DATABASE_URL=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_COMMISSION_PERCENT=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
```

**`apps/web/.env.example`**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SOCKET_URL=
```

**`apps/mobile/.env.example`**
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_SOCKET_URL=
```

---

## 2. Database Infrastructure

### 2.1 Local Development Database

A **Docker Compose** configuration provides a zero-dependency local PostgreSQL environment:

- **PostgreSQL 16** on port `5434` (arm64-optimised image)
- Health checks configured with retry logic
- Named volume for data persistence across container restarts
- PgAdmin GUI available on port `5050` (optional tools profile)

Developers run `docker compose up -d` to start the full local environment with no external dependencies.

### 2.2 Prisma Schema

The complete database schema is defined in `apps/api/prisma/schema.prisma`. All models for the full platform scope are defined at M1 (data model is complete, features are built incrementally on top of it).

**Models defined:**

| Model | Purpose |
|---|---|
| `User` | Core user record — links Clerk identity to our DB. Stores `clerkId`, `role` (CUSTOMER / PROVIDER / ADMIN), `email`, `firstName`, `lastName`, `phone`, `avatarUrl` |
| `ProviderProfile` | Extended profile for PROVIDER users. Stores bio, `verificationStatus`, `isOnline` toggle, `averageRating`, location (`latitude`/`longitude`), `totalEarnings` |
| `ProviderDocument` | ID verification documents uploaded by providers. Stores S3 key, document type, verification timestamp |
| `ServiceCategory` | Service categories (e.g. Full Detail, Interior Clean) |
| `Service` | Individual services offered by a provider. Price, duration, active status |
| `Booking` | Full booking record with status machine, location, scheduled time, total amount |
| `Review` | Star rating + comment tied to a completed booking |
| `Payment` | Stripe payment intent, transfer ID, commission amount, provider payout amount |
| `Conversation` | Messaging thread linked to a booking |
| `Message` | Individual messages (TEXT / IMAGE / SYSTEM types) |

**Enums defined:**

| Enum | Values |
|---|---|
| `UserRole` | `CUSTOMER`, `PROVIDER`, `ADMIN` |
| `BookingStatus` | `PENDING`, `ACCEPTED`, `REJECTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `PaymentStatus` | `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `REFUNDED` |
| `VerificationStatus` | `PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED` |
| `MessageType` | `TEXT`, `IMAGE`, `SYSTEM` |

### 2.3 Migration History

As of M1 completion, the database is under **Prisma Migrate** (not `db:push`). The initial migration `20260326233519_init` has been generated, applied, and committed to the repository at:

```
apps/api/prisma/migrations/
└── 20260326233519_init/
    └── migration.sql
```

Going forward, all schema changes must go through `prisma migrate dev --name <description>`. The production deployment command is `prisma migrate deploy`, available via `pnpm --filter @repo/api db:migrate:deploy`.

---

## 3. User Account System

### 3.1 Authentication Architecture

**Clerk** is the identity provider for the entire platform. It owns user registration, login, session management, and JWTs. No passwords are stored in our database. No custom auth flows are built.

- **Role** (`CUSTOMER` / `PROVIDER` / `ADMIN`) is stored in `publicMetadata.role` in Clerk and is embedded in the JWT, making it available on every request without a DB lookup.
- **Our PostgreSQL** `users` table mirrors Clerk users and stores application-specific data (bookings, provider profile, etc.)
- The two systems stay in sync via Clerk webhooks.

### 3.2 Backend Auth Module (`apps/api/src/auth/`)

**`ClerkAuthGuard`** — Applied globally to all API routes via `APP_GUARD`. Extracts the Bearer token from the `Authorization` header, verifies it against Clerk's backend SDK, and attaches the decoded payload to `request.auth`. Public routes are excluded via `@Public()` decorator.

**`RolesGuard`** — Applied globally after `ClerkAuthGuard`. Reads the `@Roles()` decorator from the handler or controller class. If no `@Roles()` decorator is present, the route is accessible to any authenticated user. If roles are specified, it fetches the user record from PostgreSQL and verifies the role matches. Throws `403 Forbidden` with a descriptive message if not.

Usage going forward:
```typescript
@Roles("ADMIN")
@Get("admin-only-endpoint")
getAdminData() { ... }
```

**`WebhookController`** — `POST /api/v1/webhooks/clerk` (public, no auth). Verifies Svix webhook signatures using `CLERK_WEBHOOK_SECRET`. Handles `user.created` and `user.updated` events by upserting the user record in PostgreSQL via `UsersService.upsertFromClerk()`. This keeps our DB in sync with Clerk automatically.

**`AuthController`** — `POST /api/v1/auth/set-role`. Called by the mobile app after first sign-up when the user selects their role. Updates Clerk `publicMetadata.role`, then upserts the full user record in PostgreSQL. The upsert (not update) pattern handles the race condition where this endpoint is called before the `user.created` webhook has been processed.

**Decorators:**
- `@Public()` — Marks a route as unauthenticated (webhook endpoint)
- `@Roles(...roles)` — Restricts a route to specific roles

### 3.3 Users Module (`apps/api/src/users/`)

`UsersService` provides:
- `upsertFromClerk(payload)` — Creates or updates user from Clerk webhook or API data
- `findByClerkId(clerkId)` — Lookup by Clerk user ID
- `findById(id)` — Lookup by internal database ID
- `setRole(clerkId, role)` — Update user role

`UsersController` — `GET /api/v1/users/:id` (authenticated, any role).

### 3.4 Mobile Auth Screens (`apps/mobile/src/app/(auth)/`)

All four auth screens are fully implemented and working end-to-end.

**Welcome Screen** (`welcome.tsx`)
- Entry point for unauthenticated users
- Two call-to-action buttons: "Get Started" (→ sign-up) and "Sign In" (→ sign-in)
- Branded with the platform design system

**Sign-Up Screen** (`sign-up.tsx`)
- Two-step flow: (1) Account details → (2) Email verification
- Fields: First name, last name, email, password (min 8 characters)
- Step 1 calls `signUp.password({ emailAddress, password, firstName, lastName })` (Clerk v6 API)
- Step 2 sends `signUp.verifications.sendEmailCode()` then collects 6-digit OTP
- Verification via `signUp.verifications.verifyEmailCode({ code })`
- On success: `signUp.finalize()` creates the session, then navigates to role-select
- Full loading states, field validation with user-facing error messages
- All errors surfaced via Alert — no silent failures

**Sign-In Screen** (`sign-in.tsx`)
- Email + password form with show/hide password toggle
- Uses Clerk v6 API: `signIn.password({ identifier, password })` then `signIn.finalize()`
- On success: auth state update triggers automatic redirect to the user's home screen via `RootNavigator`
- Error handling with descriptive messages

**Role Selection Screen** (`role-select.tsx`)
- Shown to newly signed-up users who have no role set
- Two illustrated option cards: "I need services" (CUSTOMER) and "I provide services" (PROVIDER)
- Each card shows the role title, subtitle, and three key benefits
- On confirm: calls `POST /api/v1/auth/set-role`, reloads the Clerk session (so JWT is updated with the role), then navigates directly to the appropriate home screen
- Role is permanent and cannot be changed by the user

### 3.5 Auth-Based Navigation (`apps/mobile/src/app/_layout.tsx`)

The root layout uses **imperative navigation** (not declarative `<Redirect>` components) to route users based on auth state. This prevents redirect loops that occur when declarative redirects re-fire during in-progress auth flows.

Navigation logic:
| State | Destination |
|---|---|
| Not loaded | Shows nothing (null render) |
| Not signed in, outside auth group | `/(auth)/welcome` |
| Not signed in, inside auth group | No redirect — auth flow proceeds |
| Signed in, no role, not on role-select | `/(auth)/role-select` |
| Signed in, role = PROVIDER, in auth group | `/(provider)/(tabs)/jobs` |
| Signed in, role = CUSTOMER, in auth group | `/(customer)/(tabs)/home` |
| Signed in, in correct app group | No redirect — user stays |

The Clerk session token is kept in sync with the API client (`@repo/api-client`) via a `useEffect` that updates when `isSignedIn` changes.

### 3.6 Admin Web Auth (`apps/web/`)

- `ClerkProvider` wraps the entire Next.js app
- Clerk's `auth()` server function protects the dashboard route group
- Clerk's `<SignIn>` component is rendered at `/sign-in`
- `UserButton` is visible in the admin sidebar for session management and sign-out
- Admin role enforcement is at the API level (NestJS `RolesGuard` + `@Roles("ADMIN")`)

---

## 4. Base Mobile App Structure

### 4.1 Expo Router File Structure

The mobile app uses **Expo Router v3** with file-based routing. The route structure maps exactly to the PRD's three user types.

```
apps/mobile/src/app/
├── _layout.tsx                      ← Root: ClerkProvider, auth-based routing
├── (auth)/
│   ├── _layout.tsx                  ← Stack navigator for auth screens
│   ├── welcome.tsx                  ✅ Complete
│   ├── sign-in.tsx                  ✅ Complete
│   ├── sign-up.tsx                  ✅ Complete
│   └── role-select.tsx              ✅ Complete
├── (customer)/
│   ├── _layout.tsx                  ✅ Tab navigator (Discover, Bookings, Messages, Profile)
│   └── (tabs)/
│       ├── home.tsx                 ✅ UI complete with static data (API integration = M2)
│       ├── bookings.tsx             🔲 Placeholder — M2
│       ├── messages.tsx             🔲 Placeholder — M4
│       └── profile.tsx              🔲 Placeholder — M2
└── (provider)/
    ├── _layout.tsx                  ✅ Tab navigator (Jobs, Schedule, Earnings, Profile)
    └── (tabs)/
        ├── jobs.tsx                 ✅ UI complete with static data (API integration = M3)
        ├── schedule.tsx             🔲 Placeholder — M3
        ├── earnings.tsx             🔲 Placeholder — M3
        └── profile.tsx              🔲 Placeholder — M3
```

### 4.2 Customer Navigator

The customer tab bar (`(customer)/_layout.tsx`) provides four tabs:
- **Discover** — Service category grid + provider listing cards
- **Bookings** — Booking history (placeholder, M2)
- **Messages** — Chat list (placeholder, M4)
- **Profile** — Customer profile management (placeholder, M2)

The Discover screen (`home.tsx`) shows the full designed UI — service categories, provider cards with name, service type, rating, price, distance, and availability indicator — using static/mock data. This confirms the design system and component patterns are correct before M2 wires in the real API and map.

### 4.3 Provider Navigator

The provider tab bar (`(provider)/_layout.tsx`) provides four tabs:
- **Jobs** — Job queue with accept/reject actions
- **Schedule** — Calendar view (placeholder, M3)
- **Earnings** — Earnings dashboard (placeholder, M3)
- **Profile** — Provider profile management (placeholder, M3)

The Jobs screen (`jobs.tsx`) shows the full designed UI — a stats row (Pending, Today, Rating, Earnings), a job queue list with customer name, service type, address, time, status badge, and action buttons — using static/mock data. Confirms design and component patterns before M3 API integration.

---

## 5. Base Admin Dashboard Structure

### 5.1 Next.js App Router Setup

The admin dashboard (`apps/web/`) is built on **Next.js 15 with App Router**.

```
apps/web/src/app/
├── layout.tsx               ← ClerkProvider, global CSS, metadata
├── page.tsx                 ← Landing: auth check, sign-in CTA or dashboard link
├── sign-in/
│   └── [[...sign-in]]/
│       └── page.tsx         ← Clerk-rendered sign-in UI
└── (dashboard)/
    ├── layout.tsx           ✅ Sidebar + main layout
    ├── bookings/page.tsx    🔲 Placeholder — M4/M5
    ├── users/page.tsx       🔲 Placeholder — M5
    ├── providers/page.tsx   🔲 Placeholder — M5
    ├── services/page.tsx    🔲 Placeholder — M5
    └── payments/page.tsx    🔲 Placeholder — M4
```

### 5.2 Dashboard Layout

The dashboard shell (`(dashboard)/layout.tsx`) is complete:
- Fixed sidebar (256px) with the platform branding
- Navigation links to all five admin sections: Bookings, Users, Providers, Services, Payments
- `UserButton` from Clerk for session management and sign-out
- Full-height scrollable main content area
- Responsive layout structure ready for M4/M5 content

### 5.3 Admin Authentication

- Clerk's server-side `auth()` is used to protect all dashboard routes
- Access to the dashboard requires a valid Clerk session
- ADMIN role enforcement is implemented at the API level via `RolesGuard` + `@Roles("ADMIN")` on all admin-facing API endpoints

---

## 6. Backend API Foundation

### 6.1 NestJS Application

`apps/api/src/main.ts` configures:
- Global route prefix: `/api/v1`
- CORS with configurable origins (web dashboard URL)
- Raw body parsing enabled (required for Stripe and Clerk webhook signature verification)
- Port configurable via `PORT` env variable (default 3001)

### 6.2 Module Architecture

All domain modules are scaffolded with the correct structure, ready for feature implementation in M2–M4:

| Module | Status | Milestone |
|---|---|---|
| `AuthModule` | ✅ Complete — Clerk guard, webhook, role guard, set-role | M1 |
| `UsersModule` | ✅ Complete — CRUD, Clerk sync | M1 |
| `PrismaModule` | ✅ Complete — Global singleton service | M1 |
| `ProvidersModule` | 🔲 Scaffolded — M3 | M3 |
| `BookingsModule` | 🔲 Scaffolded — M2 | M2 |
| `PaymentsModule` | 🔲 Scaffolded — M4 | M4 |
| `MessagesModule` | 🔲 Scaffolded — M4 | M4 |
| `NotificationsModule` | 🔲 Scaffolded — M4 | M4 |
| `StorageModule` | 🔲 Scaffolded — M3 | M3 |
| `RealtimeModule` | 🔲 Socket gateways bootstrapped | M4 |

### 6.3 Real-Time Infrastructure

Two Socket.io gateways are bootstrapped (not yet feature-complete):
- `BookingGateway` — `/bookings` namespace, room-based by `bookingId`, structured to emit `booking:status_changed` events (M4)
- `ChatGateway` — `/chat` namespace, room-based by `conversationId`, structured to emit `message:received` events (M4)

---

## 7. What Is Explicitly Out of Scope for M1

The following items appear in the PRD but are correctly deferred to later milestones per the agreed delivery plan. They are not missing — they are scheduled:

| Feature | PRD Reference | Target Milestone |
|---|---|---|
| Customer map view of providers | Section 5 | M2 |
| Booking creation flow | Section 6 | M2 |
| Booking status tracking | Section 6, 7 | M2 |
| Customer profile management | Section 4.1 | M2 |
| Favourites | Section 4.2 | M2 |
| Booking history screen | Section 4.3 | M2 |
| Provider profile setup + document upload | Section 11.1 | M3 |
| Provider job accept/reject (live) | Section 12 | M3 |
| Availability toggle | Section 13 | M3 |
| Provider earnings screen (live) | Section 15 | M3 |
| GPS navigation integration | Section 14 | M3 |
| Stripe payments + commission | Section 8, 21 | M4 |
| In-app messaging | Section 23 | M4 |
| Push notifications | Section 10, 24 | M4 |
| Live location tracking | Section 7, 24 | M4 |
| Admin user management | Section 18 | M5 |
| Admin provider approval | Section 19 | M5 |
| Admin booking management | Section 20 | M5 |
| Admin payments & commission config | Section 21 | M5 |
| Admin reporting | Section 22 | M5 |
| Social login (Google, Apple) | Section 4.1 | M2 |
| Unit and E2E tests | CONTRIBUTING.md | Each milestone |
| Cloud deployment (AWS) | Section 26 | M5 |

---

## 8. Technical Decisions Made in M1

These decisions are locked for the project and should not be revisited unless there is a critical reason:

| Decision | Choice | Rationale |
|---|---|---|
| Auth provider | Clerk | Free tier up to 10k MAU, first-class Expo + Next.js SDKs, role metadata in JWT, built-in webhooks |
| Database | PostgreSQL 16 via Prisma ORM | Type-safe queries, full relation support, migration tracking |
| Local dev DB | Docker (postgres:16-alpine) | Zero external dependencies, full offline dev |
| Production DB | AWS RDS | Consistent with S3/AWS infrastructure (locked for M5) |
| File storage | AWS S3 | Provider documents and service photos |
| Payments | Stripe Connect | Marketplace payment splits and automatic commission deduction |
| Real-time | Socket.io in NestJS Gateways | Live booking status, location tracking, messaging |
| Mobile styling | NativeWind v4 + Tailwind | Single utility-class mental model across web and native |
| Type safety | Zod schemas in `@repo/schemas` | Single source of truth — TypeScript types derived via `z.infer`, never hand-written |
| API versioning | `/api/v1/` prefix | All endpoints versioned from day one |

---

## 9. M1 Completion Checklist

| M1 Deliverable | Status | Evidence |
|---|---|---|
| Platform foundation ready for development | ✅ Done | Turborepo monorepo, all packages wired, turbo.json pipeline |
| User account system working | ✅ Done | Sign-up → email verify → role-select → home, all screens functional end-to-end |
| Initial app structure — Customer | ✅ Done | `(customer)` route group, 4-tab navigator, Discover screen with full UI |
| Initial app structure — Provider | ✅ Done | `(provider)` route group, 4-tab navigator, Jobs screen with full UI |
| Initial app structure — Admin | ✅ Done | Next.js dashboard with sidebar layout, Clerk auth, 5 section placeholders |
| Database ready for development | ✅ Done | PostgreSQL via Docker, full Prisma schema, migration `init` applied |
| Backend API foundation | ✅ Done | NestJS running, global prefix, auth guard, roles guard, all modules scaffolded |

---

## 10. How to Verify

Any team member or reviewer can verify M1 is working by following these steps:

**Prerequisites:** Docker running, API `.env` populated, mobile `.env` populated.

```bash
# 1. Start the database
docker compose up -d

# 2. Apply migrations and generate Prisma client
pnpm --filter @repo/api db:migrate:deploy
pnpm --filter @repo/api db:generate

# 3. Start the API
pnpm --filter @repo/api dev

# 4. Start the mobile app
pnpm --filter @repo/mobile dev

# 5. Start the admin dashboard
pnpm --filter @repo/web dev
```

**Verification flow:**
1. Open the mobile app → Welcome screen appears
2. Tap "Get Started" → Sign-up screen appears with two-step form
3. Enter name, email, password → tap Continue → email verification screen appears
4. Enter the 6-digit code from email → tap Verify → Role selection screen appears
5. Select "I need services" → tap Get Started → Customer home screen with Discover tab appears
6. Sign out and repeat selecting "I provide services" → Provider Jobs screen appears
7. Open `http://localhost:3000` → Admin sign-in page appears
8. Sign in with an admin account → Dashboard with sidebar appears
9. Open `http://localhost:3001/api/v1` → API is running (returns 404, expected — no root route)

---

**The next phase (M2 — Customer Mobile App: Booking Experience) begins starting next week.**
