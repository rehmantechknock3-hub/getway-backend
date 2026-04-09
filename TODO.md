# Post-M2 TODO — Minor Items to Address

Items carried forward from the PR#3/PR#4 review cycle. None are merge-blockers, but all should be resolved before M3 begins.

---

## Schema & Type Hygiene

- [ ] Extract `ReviewSchema` from `packages/schemas/src/booking.schema.ts` into its own `review.schema.ts` file
- [ ] Audit remaining `@prisma/client` imports — `BookingStatus` in `bookings.service.ts` and `Prisma` utility types in `providers.service.ts` / `reviews.service.ts` — and evaluate whether these can be re-exported or aliased through `@repo/schemas`

## Security Hardening

- [ ] **🔴 BLOCKER (PR#4 review)** Tighten WebSocket CORS — both gateways (`booking.gateway.ts`, `chat.gateway.ts`) currently use `cors: { origin: true }` (allow all origins). Must lock down to match the HTTP CORS config (`WEB_URL` + mobile origins) **before production deployment**. Fine locally but a deployment blocker. Use a custom `IoAdapter` or `afterInit` hook to read from `ConfigService` since `@WebSocketGateway` decorator options are evaluated before DI.
- [ ] Add rate limiting to `location:broadcast` WebSocket event to prevent DoS via GPS spam

## Mobile UI Polish

- [ ] Verify all screens consistently use `appColors` tokens from `styles/colors.ts` rather than inline values — do a full sweep of `(customer)` and `(provider)` screen directories
- [ ] Ensure `SafeAreaView` is imported from `react-native-safe-area-context` across all screens (not the deprecated `react-native` export)

## Backend Quality

- [ ] Add `Logger` usage to any remaining services that may still lack it (quick audit of all `*.service.ts` files)
- [ ] Review `notification.catch(() => undefined)` fire-and-forget pattern in `bookings.service.ts` — consider logging the swallowed error at `warn` level so failed notifications are visible in ops

## Testing

- [ ] Add boundary/edge-case tests for the booking state machine (e.g., customer-initiated cancellation flow, double-accept race condition)
- [ ] Add integration test for WebSocket auth rejection (connect without token → expect disconnect)

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

- [ ] Install packages: `pnpm --filter @repo/mobile add @sentry/react-native react-native-toast-message` and `pnpm --filter @repo/web add sonner`
- [ ] Initialize Sentry in mobile `_layout.tsx` with DSN
- [ ] Add `<Toast />` component from `react-native-toast-message` in mobile root layout (`_layout.tsx`)
- [ ] Add `<Toaster />` component from `sonner` in web root layout (`apps/web/src/app/layout.tsx`)
- [ ] Update NestJS services to accept and log `requestId` in error paths
- [ ] Validate `reportError()` Sentry detection against real `@sentry/react-native` — `globalThis.__SENTRY__` may not expose `captureException` directly. If not, switch to dynamic `require('@sentry/react-native')` in try-catch.

### UI Polish

- [ ] Add fade-out animation to service categories modal overlay (`ProviderServiceCategoriesField.tsx`) — currently fades in but snaps off instantly on close

### Retrofit Existing Screens

- [ ] Retrofit sign-in/sign-up screens to use `safeClerkCall()` + `showToast()` + `reportError()` (currently has raw try-catch)
- [ ] Audit all mobile screens for missing try-catch on async action handlers (button presses, form submits)
- [ ] Replace `Alert.alert('Error', ...)` with `showToast('error', ...)` for recoverable errors across all screens
- [ ] Ensure every `setLoading(true)` has a corresponding reset in `finally` block
