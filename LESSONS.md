# Lessons Learned — GetawayNow Marketplace

> Auto-maintained by Claude. When a fix takes 3+ attempts, the root cause and solution are logged here so future sessions don't repeat the same struggle. Read this file at the start of any debugging session.

---

## How to Read This File

Each entry follows this format:
- **Symptom** — what the error/failure looked like
- **Root cause** — the actual underlying issue (not the surface error)
- **Fix** — the exact steps that resolved it
- **Tags** — searchable keywords (`prisma`, `expo`, `clerk`, `nestjs`, `mobile`, `web`, `build`, `runtime`, `types`)

Entries are grouped by area. Newest entries go at the top of each section.

---

## Prisma / Database

_No entries yet._

## NestJS / API

_No entries yet._

## Expo / Mobile

_No entries yet._

## Next.js / Web

_No entries yet._

## Auth / Clerk

### Clerk SDK `finalize()` throws despite typed `{ error }` return

- **Symptom** — Intermittent "Uncaught (in promise, id: 0) Error: Cannot finalize sign-in without a created session" during sign-in/sign-up. No server-side logs. Inconsistent — sometimes works, sometimes crashes.
- **Root cause** — `@clerk/expo` v3's `signIn.finalize()` and `signUp.finalize()` internally throw a raw `Error` when `createdSessionId` is null, even though the TypeScript signature says `Promise<{ error: ClerkError | null }>`. The `createdSessionId` can be null if a previous sign-in attempt was interrupted (stale state) or if `.password()` succeeded but didn't create a session (e.g., needs 2FA). The code destructured `{ error }` expecting the SDK to keep its contract, so the thrown error was unhandled.
- **Fix** — Wrap all Clerk `.password()`, `.finalize()`, and `.verifications.*` calls in try-catch. Long-term: use the `safeClerkCall()` wrapper from `@repo/utils/safe-sdk`. See `BEST_PRACTICES.md` §12.
- **Tags** — `clerk`, `expo`, `mobile`, `runtime`, `auth`, `error-handling`

## Build / Config / Tooling

_No entries yet._

## Types / Schemas

_No entries yet._

## Real-time / WebSocket

_No entries yet._
