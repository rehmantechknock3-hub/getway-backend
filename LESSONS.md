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

### Provider onboarding "Network Error" on photo upload (Android / Expo Go)

- **Symptom** — Provider Continue shows Axios `Network Error` after categories + shop location. Customer onboarding may work. Console only shows Clerk dev-key warning.
- **Root cause** — Provider flow uploads a profile photo with `FormData`. Axios default `Content-Type: application/json` was left on the multipart request (`Content-Type: undefined` did not clear it on RN). Android then fails the request with no HTTP response → generic Network Error.
- **Fix** — In `api-client` request interceptor, when `data instanceof FormData`, omit Content-Type so the runtime sets multipart boundaries. Surface step-specific errors (`Photo upload failed…`) in provider onboarding. Keep API at `http://127.0.0.1:3010` with `adb reverse`.
- **Tags** — `expo`, `mobile`, `axios`, `multipart`, `avatar`, `network`


_No other entries yet._

## Expo / Mobile

### NativeWind `className` looks like unstyled HTML after splash

- **Symptom** — Splash/logo works; welcome/sign-in look fine if StyleSheet-based; role-select, onboarding, home, tabs render as plain React Native (no colors, spacing, or rounded buttons). No JS crash.
- **Root cause** — Metro config applied a custom `resolveRequest` **after** `withNativeWind()`, which replaced NativeWind’s CSS virtual-module resolver. `globals.css` never remapped, so every `className` became a no-op. Secondary: duplicate `react-native-worklets/plugin` from both `babel-preset-expo` and `nativewind/babel` on Expo SDK 54.
- **Fix** — Register the pnpm/react-native `resolveRequest` **before** `withNativeWind()` and never overwrite NativeWind’s wrapper. In babel: `babel-preset-expo` with `{ jsxImportSource: "nativewind", worklets: false, reanimated: false }` plus `"nativewind/babel"`. Keep `react-native-worklets@0.5.1` for Expo Go. Import `react-native-reanimated` in `apps/mobile/index.js`. Restart Metro with `--clear`.
- **Tags** — `expo`, `nativewind`, `metro`, `mobile`, `runtime`, `styles`

_No other entries yet._

## Next.js / Web

### Admin dashboard 401s when switching screens or refocusing tab

- **Symptom** — Console spam: `GET /api/v1/admin/stats 401` (and other admin routes) when leaving a tab, coming back, or navigating between dashboard pages. UI shows empty/error states.
- **Root cause** — Web only called `setAuthToken()` once. Clerk session JWTs expire in ~60s. Axios kept sending the stale `Authorization` header; mobile already used `setAuthTokenResolver` for a fresh token per request.
- **Fix** — Register `setAuthTokenResolver(() => getToken({ skipCache: true }))` from `AdminApiAuthBridge` (dashboard shell) and `useAdminApiReady`. Clear resolver + token on sign-out.
- **Tags** — `clerk`, `web`, `admin`, `axios`, `401`, `session`

_No other entries yet._

## Auth / Clerk

### Clerk SDK `finalize()` throws despite typed `{ error }` return

- **Symptom** — Intermittent "Uncaught (in promise, id: 0) Error: Cannot finalize sign-in without a created session" during sign-in/sign-up. No server-side logs. Inconsistent — sometimes works, sometimes crashes.
- **Root cause** — `@clerk/expo` v3's `signIn.finalize()` and `signUp.finalize()` internally throw a raw `Error` when `createdSessionId` is null, even though the TypeScript signature says `Promise<{ error: ClerkError | null }>`. The `createdSessionId` can be null if a previous sign-in attempt was interrupted (stale state) or if `.password()` succeeded but didn't create a session (e.g., needs 2FA). The code destructured `{ error }` expecting the SDK to keep its contract, so the thrown error was unhandled.
- **Fix** — Wrap all Clerk `.password()`, `.finalize()`, and `.verifications.*` calls in try-catch. Long-term: use the `safeClerkCall()` wrapper from `@repo/utils/safe-sdk`. See `BEST_PRACTICES.md` §12.
- **Tags** — `clerk`, `expo`, `mobile`, `runtime`, `auth`, `error-handling`

### Clerk `needs_client_trust` on emulator looks like finalize failure

- **Symptom** — Sign-in on Android emulator / new device fails with "Cannot finalize sign-in without a created session" (or a generic incomplete sign-in toast) even with a correct password.
- **Root cause** — Clerk Device Trust (`needs_client_trust`) requires an email OTP before `createdSessionId` exists. Calling `finalize()` before that OTP completes always throws. Stale interrupted sign-in attempts can also leave the Future API in a bad state across taps.
- **Fix** — Reset the sign-in attempt before `password()`. If status is `needs_client_trust` / `needs_second_factor`, send `signIn.mfa.sendEmailCode()`, collect the code, `verifyEmailCode`, then finalize only when `status === "complete"` and `createdSessionId` is set. Fall back to `clerk.setActive({ session })` if finalize still throws. Never surface the raw finalize error string to users.
- **Tags** — `clerk`, `expo`, `mobile`, `runtime`, `auth`, `client-trust`, `mfa`

## Build / Config / Tooling

_No entries yet._

## Types / Schemas

_No entries yet._

## Real-time / WebSocket

_No entries yet._
