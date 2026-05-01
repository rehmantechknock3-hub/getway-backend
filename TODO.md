# Post-M2 TODO — Minor Items to Address

Items carried forward from the PR#3/PR#4 review cycle. None are merge-blockers, but all should be resolved before M3 begins.

---

## Schema & Type Hygiene

- [x] Extract `ReviewSchema` from `packages/schemas/src/booking.schema.ts` into its own `review.schema.ts` file
- [x] Audit remaining `@prisma/client` imports — narrowed usage to necessary Prisma-only layers (`prisma.service.ts` + runtime/error handling in `google-maps.service.ts`, typed utility usage where needed)

## Security Hardening

- [x] **🔴 BLOCKER (PR#4 review)** Tighten WebSocket CORS — both gateways (`booking.gateway.ts`, `chat.gateway.ts`) currently use `cors: { origin: true }` (allow all origins). Must lock down to match the HTTP CORS config (`WEB_URL` + mobile origins) **before production deployment**. Fine locally but a deployment blocker. Use a custom `IoAdapter` or `afterInit` hook to read from `ConfigService` since `@WebSocketGateway` decorator options are evaluated before DI.
- [x] Add rate limiting to `location:broadcast` WebSocket event to prevent DoS via GPS spam

## Mobile UI Polish

- [x] Verify all screens consistently use `appColors` tokens from `styles/colors.ts` rather than inline values — do a full sweep of `(customer)` and `(provider)` screen directories
- [x] Ensure `SafeAreaView` is imported from `react-native-safe-area-context` across all screens (not the deprecated `react-native` export)

## Backend Quality

- [x] Add `Logger` usage to any remaining services that may still lack it (quick audit of all `*.service.ts` files)
- [x] Review `notification.catch(() => undefined)` fire-and-forget pattern in `bookings.service.ts` — consider logging the swallowed error at `warn` level so failed notifications are visible in ops
- [x] Swap backend Haversine duplication in `providers.service.ts` to `haversineDistance()` from `@repo/utils`

## Testing

- [x] Add boundary/edge-case tests for the booking state machine (e.g., customer-initiated cancellation flow, double-accept race condition)
- [x] Add integration test for WebSocket auth rejection (connect without token → expect disconnect)

## M3 — Error Handling & Observability

### Infrastructure — Scaffolded

- [x] Create shared toast utility in `packages/ui/src/toast.tsx` (abstracts library choice)
- [x] Create `packages/utils/src/error-reporting.ts` — `reportError()` that routes to Sentry (prod) or structured console (dev)
- [x] Create `packages/utils/src/safe-sdk.ts` — `safeClerkCall()` wrapper for dishonest SDK methods
- [x] Add `randomUUID()` to `packages/utils` (crypto.randomUUID polyfill for React Native)
- [x] Add Axios request interceptor in `packages/api-client/src/client.ts` — generate UUID, attach `X-Request-ID` header
- [x] Add Axios response interceptor — attach Sentry breadcrumb with request-id, method, URL, status
- [x] Create `apps/api/src/common/request-id.middleware.ts` — extract/generate request-id, attach to `req`, echo in response
- [x] Register `RequestIdMiddleware` globally in `AppModule`

### Infrastructure — Requires App-Specific Integration

- [x] Install packages: `pnpm --filter @repo/mobile add @sentry/react-native react-native-toast-message` and `pnpm --filter @repo/web add sonner`
- [x] Initialize Sentry in mobile `_layout.tsx` with DSN
- [x] Add `<Toast />` component from `react-native-toast-message` in mobile root layout (`_layout.tsx`)
- [x] Add `<Toaster />` component from `sonner` in web root layout (`apps/web/src/app/layout.tsx`)
- [x] Update NestJS services to accept and log `requestId` in error paths
- [x] Validate `reportError()` Sentry detection against real `@sentry/react-native` — `globalThis.__SENTRY__` may not expose `captureException` directly. If not, switch to dynamic `require('@sentry/react-native')` in try-catch.

### UI Polish

- [x] Add fade-out animation to service categories modal overlay (`ProviderServiceCategoriesField.tsx`) — currently fades in but snaps off instantly on close

### Retrofit Existing Screens

- [x] Retrofit sign-in/sign-up screens to use `safeClerkCall()` + `showToast()` + `reportError()` (currently has raw try-catch)
- [x] Audit all mobile screens for missing try-catch on async action handlers (button presses, form submits)
- [x] Replace `Alert.alert('Error', ...)` with `showToast('error', ...)` for recoverable errors across all screens
- [x] Ensure every `setLoading(true)` has a corresponding reset in `finally` block
