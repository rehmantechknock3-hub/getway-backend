# Getting Started — GetawayNow Marketplace

Local dev guide for new engineers. All commands run from the **repo root** unless noted.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| pnpm | 9.15.0 | `npm i -g pnpm@9.15.0` |
| Docker Desktop | latest | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Expo Go (optional) | latest | App Store / Play Store |

---

## 1 — Clone & Install

```bash
git clone <repo-url>
cd marketplace
pnpm install
```

---

## 2 — Set Up Environment Variables

```bash
pnpm setup:env
```

This copies each app's `.env.example` → `.env`. It is safe to re-run — it won't overwrite an existing `.env`.

Then open each file and fill in the secret values:

| File | Secrets to fill in |
|---|---|
| `apps/api/.env` | `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| `apps/web/.env` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| `apps/mobile/.env` | `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` |

Get the Clerk keys from the [Clerk dashboard](https://dashboard.clerk.com) → your app → **API Keys**.
Get the Stripe keys from the [Stripe dashboard](https://dashboard.stripe.com) → **Developers → API keys**.
Get the AWS credentials from the team's shared secrets manager.

---

## 3 — Start the Database

```bash
docker compose up -d
```

This starts PostgreSQL on port **5434**. The connection string in `apps/api/.env` already points there.

Run once (or after schema changes):

```bash
pnpm db:generate   # regenerate Prisma client
pnpm db:push       # push schema to the local DB (dev only — no migration files)
```

> **After any change to `apps/api/prisma/schema.prisma`** you must re-run `pnpm db:generate`. Skipping this is the #1 cause of mysterious type errors.

---

## 4 — Running the Apps

### All three at once (recommended for full-stack work)

```bash
pnpm dev
```

Turbo starts all apps in parallel via its TUI. Ports:

| App | URL |
|---|---|
| API (NestJS) | http://localhost:3001 |
| Web (Next.js admin) | http://localhost:3000 |
| Mobile (Expo) | Expo DevTools in terminal + Expo Go on device |

---

### Running apps individually

Open a terminal per app, or use `pnpm --filter`.

**API only**
```bash
# from repo root
pnpm --filter @repo/api dev

# or directly
cd apps/api
pnpm dev
```

**Web (admin dashboard) only**
```bash
pnpm --filter @repo/web dev

# or
cd apps/web
pnpm dev
```

**Mobile only**
```bash
pnpm --filter @repo/mobile dev

# or
cd apps/mobile
pnpm dev
```

For mobile you can also run on a specific platform:
```bash
cd apps/mobile
pnpm ios       # opens iOS Simulator
pnpm android   # opens Android Emulator
```

---

## 5 — Other Useful Commands

```bash
# From repo root
pnpm type-check        # tsc --noEmit across all apps + packages
pnpm lint              # ESLint across all apps + packages
pnpm test              # Vitest (API unit tests)
pnpm db:studio         # Open Prisma Studio at http://localhost:5555
pnpm db:migrate        # Create a new migration (after schema changes in production flow)

# pgAdmin (optional DB GUI) — starts on http://localhost:5050
docker compose --profile tools up -d
# Login: admin@marketplace.dev / admin
```

---

## 6 — Clerk Webhook (local dev)

The API needs to receive Clerk webhooks to upsert users into Postgres.

1. Install ngrok: `brew install ngrok`
2. In a separate terminal: `ngrok http 3001`
3. Copy the HTTPS forwarding URL (e.g. `https://abc123.ngrok.io`)
4. In `apps/api/.env` set:
   ```
   CLERK_WEBHOOK_SECRET=whsec_<from Clerk dashboard>
   ```
5. In the Clerk dashboard → **Webhooks → Add endpoint**:
   - URL: `https://abc123.ngrok.io/api/v1/auth/webhook`
   - Events: `user.created`, `user.updated`

> The webhook URL must be the **ngrok HTTPS URL** pointing to port 3001, never `localhost`.

---

## 7 — Stripe Webhook (local dev)

1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. `stripe login`
3. `stripe listen --forward-to localhost:3001/api/v1/payments/webhook`
4. Copy the webhook signing secret it prints into `apps/api/.env` as `STRIPE_WEBHOOK_SECRET`.

---

## Architecture Quick Reference

```
marketplace/
├── apps/
│   ├── api/        NestJS REST API + Socket.io  (port 3001)
│   ├── web/        Next.js 15 admin dashboard   (port 3000)
│   └── mobile/     Expo SDK 54 (Customer + Provider, role-based)
└── packages/
    ├── schemas/    Zod schemas — single source of truth for all types
    ├── api-client/ TanStack Query v5 hooks + Axios
    ├── hooks/      Platform-agnostic business logic (no JSX)
    ├── ui/         NativeWind v4 cross-platform components
    ├── utils/      Currency, date, geo helpers
    └── config/     Shared ESLint, TypeScript, Tailwind configs
```

See `CLAUDE.md` for deeper architecture notes, and `milestones.md` for the delivery plan.
