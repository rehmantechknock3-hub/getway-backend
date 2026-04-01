# GetawayNow — Service Marketplace Platform

A multi-sided service marketplace: customers discover and book providers, providers manage jobs and earnings, admins oversee the platform. Single mobile app with role-based routing, an admin web dashboard, and a NestJS REST + WebSocket backend.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Tech Stack & Exact Versions](#tech-stack--exact-versions)
4. [Prerequisites](#prerequisites)
5. [Local Dev Setup](#local-dev-setup)
6. [Environment Variables](#environment-variables)
7. [Database](#database)
8. [Auth (Clerk)](#auth-clerk)
9. [Payments (Stripe)](#payments-stripe)
10. [File Storage (AWS S3)](#file-storage-aws-s3)
11. [Real-time (Socket.io)](#real-time-socketio)
12. [Mobile App Structure](#mobile-app-structure)
13. [NestJS API Structure](#nestjs-api-structure)
14. [Shared Packages](#shared-packages)
15. [Turbo Commands](#turbo-commands)
16. [Deployment](#deployment)
17. [Milestones](#milestones)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                       Clients                           │
│  apps/mobile (Expo + Expo Router)  apps/web (Next.js)   │
└──────────────────────┬──────────────────────────────────┘
                       │  REST /api/v1/* + Socket.io
┌──────────────────────▼──────────────────────────────────┐
│                  apps/api (NestJS)                       │
│  ClerkAuthGuard → Controllers → Services → Prisma ORM   │
└───┬──────────────┬──────────────┬───────────────────────┘
    │              │              │
 PostgreSQL     Stripe         AWS S3
 (via Docker    (payments +    (file uploads,
  locally /     Connect)       presigned URLs)
  RDS in prod)
```

**Identity layer:** Clerk owns all auth — JWTs are issued by Clerk and validated in the API via `@clerk/backend`. Role (`CUSTOMER | PROVIDER | ADMIN`) lives in `publicMetadata.role`.

---

## Monorepo Structure

```
marketplace/
├── apps/
│   ├── api/          NestJS REST API + Socket.io gateways
│   ├── mobile/       Expo SDK 54 — role-based Customer + Provider app
│   └── web/          Next.js 15 Admin Dashboard
├── packages/
│   ├── schemas/      @repo/schemas   — Zod schemas (single source of truth)
│   ├── api-client/   @repo/api-client — TanStack Query hooks + Axios
│   ├── hooks/        @repo/hooks     — platform-agnostic business logic
│   ├── ui/           @repo/ui        — NativeWind cross-platform primitives
│   ├── utils/        @repo/utils     — currency, date, geo helpers
│   └── config/       @repo/config    — shared ESLint, TS, Tailwind configs
├── turbo.json
├── pnpm-workspace.yaml
├── docker-compose.yml
└── package.json
```

**Package boundary rules (strictly enforced):**
- `packages/*` MUST NOT import from `apps/*`
- `apps/*` may import from `packages/*` but NEVER from sibling `apps/*`
- `packages/ui` — presentational only, no business logic, no API calls
- `packages/hooks` and `packages/api-client` — NO JSX

---

## Tech Stack & Exact Versions

### Runtime & Tooling
| Tool | Version |
|---|---|
| Node.js | ≥ 20 (LTS) |
| pnpm | 9.15.0 |
| TypeScript | 5.6.x |
| Turbo | 2.8.x |

### apps/api — NestJS Backend
| Package | Version |
|---|---|
| `@nestjs/common` | ^11.1.17 |
| `@nestjs/core` | ^11.1.17 |
| `@nestjs/platform-express` | ^11.1.17 |
| `@nestjs/platform-socket.io` | ^11.1.13 |
| `@nestjs/websockets` | ^11.1.16 |
| `@nestjs/config` | ^4.0.3 |
| `@nestjs/cli` | ^11.0.16 (dev) |
| `@prisma/client` | ^6.19.0 |
| `prisma` | ^6.19.0 (dev) |
| `@clerk/backend` | ^3.0.1 |
| `nestjs-zod` | ^5.1.1 |
| `zod` | ^3.25.0 |
| `stripe` | ^20.4.1 |
| `svix` | ^1.89.0 |
| `socket.io` | ^4.8.3 |
| `rxjs` | ^7.8.0 |
| `reflect-metadata` | ^0.2.0 |
| `vitest` | ^2.0.0 (dev) |

### apps/mobile — Expo App
| Package | Version |
|---|---|
| `expo` | ~54.0.33 |
| `expo-router` | ~6.0.23 |
| `react` | 19.1.0 |
| `react-native` | 0.81.5 |
| `@clerk/expo` | ^3.1.5 |
| `nativewind` | ^4.2.3 |
| `tailwindcss` | ^3.4.0 |
| `@tanstack/react-query` | ^5.95.2 |
| `react-native-maps` | 1.20.1 |
| `react-native-reanimated` | ~4.1.1 |
| `react-native-safe-area-context` | ~5.6.0 |
| `react-native-screens` | ~4.16.0 |
| `expo-location` | ~19.0.8 |
| `expo-notifications` | ~0.32.16 |
| `expo-secure-store` | ~15.0.8 |
| `expo-constants` | ~18.0.13 |
| `expo-font` | ~14.0.11 |
| `expo-linking` | ~8.0.11 |
| `expo-crypto` | ~15.0.8 |
| `expo-status-bar` | ~3.0.9 |
| `socket.io-client` | ^4.8.3 |
| `@expo/vector-icons` | ^15.0.3 |

### apps/web — Next.js Admin
| Package | Version |
|---|---|
| `next` | ^15.2.3 |
| `react` | 18.3.1 |
| `react-dom` | 18.3.1 |
| `@clerk/nextjs` | ^7.0.5 |
| `@tanstack/react-query` | ^5.95.0 |
| `tailwindcss` | ^3.4.0 |

---

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** 9.15.0 — `npm install -g pnpm@9.15.0`
- **Docker Desktop** — for the local PostgreSQL container
- **Expo CLI** — `npm install -g expo-cli` (or `npx expo`)
- **iOS Simulator** (macOS) or **Android Emulator** for mobile dev
- Accounts: [Clerk](https://clerk.com), [Stripe](https://stripe.com), [AWS](https://aws.amazon.com)
- **ngrok** (or similar) to expose the local API for Clerk webhooks during dev

---

## Local Dev Setup

```bash
# 1. Clone and install
git clone https://github.com/wajahat-khan-fr/getwaynow.git
cd getwaynow
pnpm install

# 2. Copy env files and fill in secrets
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
# (web env vars go in apps/web/.env.local — not committed)

# 3. Start the local Postgres container
docker compose up -d

# 4. Push the Prisma schema and generate the client
pnpm db:push
pnpm db:generate

# 5. Start all apps in parallel
pnpm dev
```

| App | URL / Command |
|---|---|
| API | http://localhost:3001 |
| Web (Admin) | http://localhost:3000 |
| Mobile | Expo DevTools (scan QR with Expo Go) |
| pgAdmin | http://localhost:5050 (run `docker compose --profile tools up -d`) |

---

## Environment Variables

### apps/api/.env
```env
PORT=3001
WEB_URL=http://localhost:3000
SOCKET_CORS_ORIGIN=http://localhost:3000

DATABASE_URL="postgresql://postgres:postgres@localhost:5434/marketplace"

CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_COMMISSION_PERCENT=15

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=marketplace-assets
```

### apps/mobile/.env
```env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_SOCKET_URL=http://localhost:3001
```

### apps/web/.env.local
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

> **Never commit `.env` files.** Only `.env.example` files are committed.

---

## Database

- **Engine:** PostgreSQL 16 (Docker locally, AWS RDS in production)
- **ORM:** Prisma 6
- **Local port:** `5434` (mapped from container's 5432 to avoid conflicts)
- **Connection string:** `postgresql://postgres:postgres@localhost:5434/marketplace`

### Key Models
| Model | Description |
|---|---|
| `User` | Synced from Clerk via webhook. Holds `clerkId`, role, contact info. |
| `ProviderProfile` | Extended profile for PROVIDER users. Location, rating, earnings. |
| `ProviderDocument` | Verification docs (S3 keys, verified timestamp). |
| `ServiceCategory` | Top-level categories (e.g. Cleaning, Plumbing). |
| `Service` | A provider's listed service with price and duration. |
| `Booking` | Customer ↔ Provider booking with status machine and location. |
| `Payment` | Stripe PaymentIntent + Transfer record, commission breakdown. |
| `Conversation` | One per booking. Container for Messages. |
| `Message` | TEXT / IMAGE / SYSTEM message in a Conversation. |
| `Review` | One per completed Booking. Rating + optional comment. |

### Booking Status Machine
```
PENDING → ACCEPTED → IN_PROGRESS → COMPLETED
        → REJECTED
        → CANCELLED (from PENDING or ACCEPTED)
```

### Prisma Commands
```bash
pnpm db:push        # push schema to dev DB (no migration file, fastest for dev)
pnpm db:migrate     # create a named migration file
pnpm db:generate    # regenerate Prisma client after schema change
pnpm db:studio      # open Prisma Studio GUI at http://localhost:5555
```

---

## Auth (Clerk)

- **Clerk** owns 100% of auth. Never build custom auth flows or store passwords.
- Role is stored in `publicMetadata.role`: `CUSTOMER | PROVIDER | ADMIN`
- New users pick their role on the `role-select` screen; the mobile app calls the API which sets the role via the Clerk Admin SDK.
- The API uses a custom `ClerkAuthGuard` that validates the JWT in the `Authorization: Bearer <token>` header using `@clerk/backend`.
- Clerk fires `user.created` / `user.updated` webhooks → `POST /api/v1/auth/webhook` → Prisma upserts the `User` record.

### Webhook Setup (local dev)
```bash
# Expose the local API
ngrok http 3001

# In Clerk Dashboard → Webhooks → Add endpoint:
# https://<your-ngrok-id>.ngrok-free.app/api/v1/auth/webhook
# Events: user.created, user.updated
```

---

## Payments (Stripe)

- **Stripe Connect** (Standard or Express) for provider payouts.
- Commission deducted automatically via `application_fee_amount` on the PaymentIntent (`STRIPE_COMMISSION_PERCENT` env var, default 15%).
- Webhook `payment_intent.succeeded` → mark booking PAID → trigger provider payout.
- `Payment` DB record stores: `stripePaymentIntentId`, `stripeTransferId`, `platformCommissionAmount`, `providerAmount`.

---

## File Storage (AWS S3)

- Never return raw S3 keys to clients. Always return presigned URLs.
  - GET presigned URL: 1-hour TTL
  - PUT presigned URL: 15-minute TTL
- Upload flow: client requests presigned PUT URL → uploads directly to S3 → sends S3 key back to API to store in DB.

### Bucket folder structure
```
provider-documents/<userId>/<type>/<filename>
service-photos/<providerId>/<serviceId>/<filename>
avatars/<userId>/<filename>
```

---

## Real-time (Socket.io)

- Socket.io v4 runs inside NestJS using `@nestjs/platform-socket.io` and `@nestjs/websockets`.
- Auth: Clerk JWT must be passed in `handshake.auth.token`.
- Event naming convention: `domain:action` — e.g. `booking:status_changed`, `location:updated`, `message:received`.

### Gateways
| Gateway | Namespace | Events |
|---|---|---|
| `BookingGateway` | `/booking` | `booking:status_changed`, `booking:location_updated` |
| `ChatGateway` | `/chat` | `message:received`, `message:read` |

---

## Mobile App Structure

Single Expo app. Root layout reads `publicMetadata.role` from Clerk and redirects to the correct navigator.

```
apps/mobile/src/app/
├── _layout.tsx               Root: ClerkProvider + role-based redirect
├── (auth)/
│   ├── welcome.tsx
│   ├── sign-in.tsx
│   ├── sign-up.tsx
│   └── role-select.tsx       First sign-up: set role
├── (customer)/
│   ├── _layout.tsx           Customer tab navigator
│   ├── (tabs)/home.tsx       Map + provider discovery
│   ├── (tabs)/bookings.tsx
│   ├── (tabs)/messages.tsx
│   ├── (tabs)/profile.tsx
│   └── booking/[id].tsx      Booking detail + live tracking
└── (provider)/
    ├── _layout.tsx           Provider tab navigator
    ├── (tabs)/jobs.tsx       Job queue (accept/reject)
    ├── (tabs)/schedule.tsx
    ├── (tabs)/earnings.tsx
    ├── (tabs)/profile.tsx
    └── job/[id].tsx
```

**Design system:** "Ember & Stone" — warm amber primary, stone neutrals. See `packages/ui` for component primitives and NativeWind v4 token conventions.

---

## NestJS API Structure

All routes: `/api/v1/<resource>`

```
apps/api/src/
├── auth/            ClerkAuthGuard, webhook handler, role decorators
├── users/           User profile CRUD
├── providers/       Provider profile, verification, availability
├── services/        Service listings (linked to categories)
├── bookings/        Booking lifecycle + status machine
├── payments/        Stripe Connect, charges, payouts, commission
├── messages/        Conversation + message CRUD
├── notifications/   Push notification dispatch
├── storage/         AWS S3 presigned URL generation
└── realtime/        Socket.io gateways (booking, chat, location)
```

Each domain follows the module structure:
- `<domain>.module.ts`
- `<domain>.controller.ts`
- `<domain>.service.ts`
- `<domain>.gateway.ts` (if real-time needed)

DTOs are validated with `ZodValidationPipe` (via `nestjs-zod`). Schemas always imported from `@repo/schemas`.

---

## Shared Packages

### @repo/schemas
Zod schemas are the **single source of truth** for all data shapes. TypeScript types are always inferred — never manually declared for entities.

```ts
export const BookingSchema = z.object({ ... });
export type Booking = z.infer<typeof BookingSchema>;
export const CreateBookingSchema = BookingSchema.pick({ ... });
export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;
```

A schema change immediately surfaces TypeScript errors across all apps.

### @repo/api-client
TanStack Query hooks + Axios client. Each resource has `use<Resource>Query` and `use<Resource>Mutation` hooks. No JSX.

### @repo/hooks
Platform-agnostic business logic hooks (usable in both mobile and web). No JSX, no API calls — pure logic.

### @repo/ui
NativeWind v4 cross-platform primitives (Text, Button, Card, Input, etc.). Presentational only — no business logic.

### @repo/utils
Currency formatting, date helpers, geo/distance utilities.

### @repo/config
Shared ESLint, TypeScript base config, Tailwind preset.

---

## Turbo Commands

```bash
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all apps and packages
pnpm type-check       # tsc --noEmit across entire monorepo
pnpm lint             # Lint all packages
pnpm test             # Run all unit tests (Vitest)

pnpm db:push          # Push Prisma schema to dev DB
pnpm db:generate      # Regenerate Prisma client
pnpm db:migrate       # Create a named migration
pnpm db:studio        # Open Prisma Studio
```

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| React components | PascalCase | `BookingCard.tsx` |
| Hooks | camelCase + `use` prefix | `useBookingTracking.ts` |
| Zod schemas | `<Entity>Schema` | `BookingSchema` |
| Inferred types | Entity name, no suffix | `Booking`, `CreateBookingInput` |
| NestJS controllers | `<domain>.controller.ts` | `bookings.controller.ts` |
| Socket events | `domain:action` | `booking:status_changed` |
| S3 folders | kebab-case | `provider-documents/` |

---

## Deployment

| Layer | Service |
|---|---|
| API | AWS EC2 / ECS or any Node host |
| Database | AWS RDS PostgreSQL |
| File Storage | AWS S3 |
| Mobile | EAS Build (Expo Application Services) |
| Web (Admin) | Vercel (Next.js) |
| Auth | Clerk (managed) |
| Payments | Stripe (managed) |

---

## Milestones

| Milestone | Weeks | Focus |
|---|---|---|
| M1 | 1–3 | Foundation, Auth, base app structure ✅ |
| M2 | 4–7 | Customer App — discovery, booking |
| M3 | 8–10 | Provider App — jobs, availability, earnings |
| M4 | 11–13 | Payments, Messaging, Real-time |
| M5 | 14–16 | Admin Dashboard, Testing, Launch |

See `milestones.md` for the full delivery plan.
