# Best Practices — GetawayNow Marketplace

These rules are mandatory. Every PR, every file, every feature must follow them.
Claude must apply all of these without being asked.

---

## 1. Import Order

Every file must use this exact import order with a **blank line between each group**. No exceptions.

```ts
// ─── Group 1: React core ──────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';

// ─── Group 2: React ecosystem (React Native, Expo, safe-area, navigation) ─────
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';

// ─── Group 3: Third-party libraries ───────────────────────────────────────────
import MapboxGL from '@rnmapbox/maps';
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';

// ─── Group 4: Internal / local imports ────────────────────────────────────────
import { Button } from '@repo/ui';
import { BookingSchema } from '@repo/schemas';
import { useBookings } from '@repo/api-client';
import { formatCurrency } from '@repo/utils';
import { BookingCard } from '~/components/BookingCard';
import { useMapRegion } from '~/hooks/useMapRegion';
```

**Group definitions:**
| Group | What goes here |
|---|---|
| 1 | `react` and nothing else |
| 2 | `react-native`, `expo-*`, `@expo/*`, `react-native-*`, `@clerk/clerk-expo`, `@clerk/nextjs`, `next/*`, `@nestjs/*`, navigation |
| 3 | All other third-party npm packages (`@tanstack/*`, `zod`, `stripe`, `socket.io*`, `mapbox`, `axios`, etc.) |
| 4 | Workspace packages (`@repo/*`) and project-local paths (`~/`, `./`, `../`) |

**ESLint enforces this** via `import/order` rules in `@repo/config`. Never disable the rule — fix the import instead.

---

## 2. Types — No Manual Entity Types

- **Never** manually write a TypeScript `type` or `interface` for a domain entity (User, Booking, Service, etc.).
- **Always** derive types from Zod schemas in `packages/schemas`:

```ts
// ✅ Correct
import { BookingSchema } from '@repo/schemas';
export type Booking = z.infer<typeof BookingSchema>;

// ❌ Wrong — hand-written type that can drift from the schema
export type Booking = {
  id: string;
  status: string;
  // ...
};
```

- Component prop types and local UI state types (not domain entities) may be written manually.
- DTO types in NestJS controllers must use `nestjs-zod` — never `class-validator` or hand-rolled interfaces.
- Use `unknown` over `any`. If you must cast, use `as` only at system boundaries (API responses, external SDK callbacks) and add a comment explaining why.

---

## 3. Styling — No Hardcoded Colors or Sizes

### Forbidden patterns
```tsx
// ❌ Hardcoded hex in arbitrary value
className="text-[#1A1A1A] bg-[#F5F5F0]"

// ❌ Hardcoded px values for brand spacing/typography
className="text-[16px] leading-[24px]"

// ❌ Inline style with raw values
style={{ color: '#FF6B35', fontSize: 16 }}
```

### Required: use theme tokens only
All colors, font sizes, font families, spacing, and border radii must come from the design token system defined in `packages/config/tailwind.preset.js`.

```tsx
// ✅ Theme tokens
className="text-foreground bg-background"
className="text-primary font-heading text-lg"
className="bg-card border border-border rounded-xl p-4"

// ✅ Semantic color roles (define these in the Tailwind preset)
// primary       — Ember amber (brand CTA)
// secondary     — Stone warm neutral
// background    — Page/screen background
// foreground    — Default text
// muted         — Subdued text / placeholders
// card          — Card surface
// border        — Default border
// destructive   — Errors, destructive actions
// success       — Confirmation states
```

### Arbitrary values — when they are allowed
Only for **layout math** that has no token equivalent (e.g. `w-[calc(100%-32px)]`, `top-[88px]` for a pixel-perfect safe-area offset). Add a comment explaining the magic number.

### Fonts
Use the font family tokens. Never pass a raw font name string.
```tsx
// ✅
className="font-heading"   // maps to Inter-Bold or brand heading font
className="font-body"      // maps to Inter-Regular
className="font-mono"      // maps to JetBrainsMono or similar

// ❌
style={{ fontFamily: 'Inter-Bold' }}
```

---

## 4. Backend — Tests for Every Feature

Every NestJS module must have a corresponding test file. No untested controllers or services are merged.

### Structure
```
apps/api/src/bookings/
├── bookings.controller.ts
├── bookings.service.ts
├── bookings.module.ts
└── bookings.service.spec.ts   ← required
    bookings.controller.spec.ts ← required for non-trivial controllers
```

### Test rules
- Use **Vitest** (`vitest`) — already in devDependencies.
- Test files live next to the source file: `<name>.spec.ts`
- Services: unit test with mocked Prisma client. Use `vi.mock` or inject a mock via NestJS testing module.
- Controllers: integration test using `@nestjs/testing` `TestingModule`. Mock the service layer.
- Gateways: unit test event handlers with mocked socket instance.
- Every `service` method gets at least:
  - A happy-path test
  - A not-found / invalid-input test
  - Any status-machine transition test (critical for `BookingsService`)

```ts
// Example: bookings.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: {
            booking: {
              findUnique: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(BookingsService);
    prisma = module.get(PrismaService);
  });

  it('throws NotFoundException when booking does not exist', async () => {
    vi.spyOn(prisma.booking, 'findUnique').mockResolvedValue(null);
    await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
  });
});
```

---

## 5. NestJS — Error Handling & HTTP Semantics

- Use NestJS built-in exceptions: `NotFoundException`, `ForbiddenException`, `BadRequestException`, `ConflictException`, `UnauthorizedException`. Never throw raw `Error`.
- Never swallow errors with empty `catch {}` blocks.
- Log unexpected errors via NestJS `Logger` (injected per module) before re-throwing.
- **Always include the Request-ID in log context.** The `RequestIdMiddleware` attaches `req.requestId` from the `X-Request-ID` header (or generates one). Use it in every service log call so backend traces can be correlated with mobile Sentry reports.

```ts
// ✅ Service with Request-ID context
private readonly logger = new Logger(BookingsService.name);

async findOne(id: string, requestId?: string) {
  const booking = await this.prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    this.logger.warn(`Booking ${id} not found [rid:${requestId}]`);
    throw new NotFoundException(`Booking ${id} not found`);
  }
  return booking;
}
```

- **External API / third-party calls inside services** must be wrapped in try-catch with contextual logging:

```ts
// ✅ Wrapping an external call in a service
async verifyStripePayment(paymentIntentId: string, requestId?: string) {
  try {
    return await this.stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error: unknown) {
    this.logger.error(
      `Stripe retrieve failed for ${paymentIntentId} [rid:${requestId}]`,
      error instanceof Error ? error.stack : undefined,
    );
    throw new BadRequestException('Payment verification failed');
  }
}
```

### Request-ID Middleware

The `RequestIdMiddleware` (`apps/api/src/common/request-id.middleware.ts`) must be applied globally in `AppModule`. It:
1. Reads `X-Request-ID` from the incoming request header (the mobile/web client generates it)
2. Falls back to a new UUID if none is present
3. Attaches it to `req.requestId`
4. Echoes it back in the response `X-Request-ID` header

```ts
// ❌ Service log without context — useless in production
this.logger.error('Something failed');

// ✅ Service log with Request-ID and entity context
this.logger.error(`Failed to update booking ${id} [rid:${requestId}]`, error.stack);
```

---

## 6. NestJS — Guard & Role Usage

- Every route is protected by `ClerkAuthGuard` globally.
- Use `@Public()` decorator only for routes that genuinely need no auth (e.g. Clerk webhook endpoint, health check).
- Use `@Roles(UserRole.ADMIN)` + `RolesGuard` for role-restricted endpoints.
- Never read `req.user` without asserting it exists first.

---

## 7. Prisma — Safe Query Patterns

- Always select only the fields you need (`select: {}`) in list queries to avoid leaking sensitive data.
- Use Prisma transactions (`prisma.$transaction`) for any multi-step write (e.g. create Booking + create Conversation atomically).
- After any schema change: run `pnpm db:generate`. Never commit a migration without regenerating the client.
- Use `@@map` on every new model to keep DB column names snake_case.

---

## 8. Mobile — Component Rules

- Every screen component goes in `apps/mobile/src/app/` following Expo Router file-based routing.
- Reusable UI primitives go in `packages/ui`.
- Feature-specific components that are not reusable go in `apps/mobile/src/components/<feature>/`.
- No `StyleSheet.create` — use NativeWind `className` exclusively.
- No `Platform.OS === 'ios'` hacks in shared components — use platform-specific files (`.ios.tsx` / `.android.tsx`) if truly needed.
- Always wrap screens in `SafeAreaView` from `react-native-safe-area-context`, not the one from `react-native`.

---

## 9. API Client — Data Fetching Rules

- All server state lives in TanStack Query. No `useState` + `useEffect` for fetching.
- Query keys follow the pattern: `['resource', id?, filters?]` — defined as constants in `@repo/api-client`.
- Mutations must call `queryClient.invalidateQueries` on success to keep cache fresh.
- Never call Axios directly from a screen or component — always go through a hook in `@repo/api-client`.

---

## 10. General Code Quality

- No `console.log` in committed code. Use `Logger` in NestJS, remove debug logs from mobile/web before committing.
- No `// @ts-ignore` or `// @ts-nocheck`. Fix the underlying type problem.
- No magic numbers. Extract to a named constant with a comment if the value isn't obvious.
- Zod schema validation at every system boundary (API input, webhook payload, external API response). Trust nothing from outside.
- Keep components focused: if a file exceeds ~200 lines, consider splitting it.
- Run `pnpm type-check` and `pnpm lint` locally before pushing. CI blocks on failures.

---

## 11. Mobile — Error Handling & User Feedback

### The Boundary Rule

Every user-facing async action handler (button press, form submit, pull-to-refresh callback) **must** have a top-level try-catch. This is the single most important error handling rule in the mobile app.

```tsx
// ✅ Correct — top-level boundary catches everything
async function handleSubmitBooking() {
  try {
    await createBooking.mutateAsync(payload);
    showToast('success', 'Booking confirmed');
  } catch (error: unknown) {
    reportError(error, { screen: 'BookingScreen', action: 'submitBooking' });
    showToast('error', error instanceof Error ? error.message : 'Something went wrong');
  }
}

// ❌ Wrong — no catch, spinner spins forever if promise rejects
async function handleSubmitBooking() {
  setLoading(true);
  await createBooking.mutateAsync(payload);
  setLoading(false);
}

// ❌ Wrong — catch swallows error silently
async function handleSubmitBooking() {
  try {
    await createBooking.mutateAsync(payload);
  } catch {
    // "it's fine"
  }
}
```

### Toast vs Alert

| Use | When |
|---|---|
| **Toast** (`showToast`) | Recoverable errors: network timeout, validation failure, "try again" scenarios. Also success confirmations. |
| **Alert** (`Alert.alert`) | "Action required" only: session expired (must re-login), destructive confirmation ("Delete this booking?"), permission denied (must go to settings). |

```tsx
// ✅ Toast for a recoverable error
showToast('error', 'Could not load services. Pull to retry.');

// ✅ Alert for action required
Alert.alert('Session Expired', 'Please sign in again.', [
  { text: 'Sign In', onPress: () => signOut() },
]);

// ❌ Alert for a network error — user can't do anything with this modal
Alert.alert('Error', 'Network request failed');
```

### Error Reporting Protocol

Every catch block must call the `reportError` utility from `@repo/utils`. Never just `console.error`.

```tsx
import { reportError } from '@repo/utils';

// reportError does:
// - Production: Sentry.captureException with screen/action/userId context
// - Development: structured console output → [ERROR] [Screen] [action] -> {message, code, stack}
// - Always: returns void, never throws

catch (error: unknown) {
  reportError(error, {
    screen: 'ProviderOnboarding',
    action: 'submitOnboarding',
    // userId is auto-attached from Sentry user context, no need to pass manually
  });
  showToast('error', 'Failed to save. Please try again.');
}
```

### Loading State Safety

If you set `setLoading(true)` before an async call, the `finally` block (or try-catch structure) **must** reset it. A stuck spinner is worse than showing an error.

```tsx
// ✅ Loading always resets
async function handleSave() {
  setLoading(true);
  try {
    await save.mutateAsync(data);
    showToast('success', 'Saved');
  } catch (error: unknown) {
    reportError(error, { screen: 'Profile', action: 'save' });
    showToast('error', 'Save failed');
  } finally {
    setLoading(false);
  }
}
```

---

## 12. Third-Party SDK Wrappers — The "Safe SDK" Pattern

### Why

Some SDKs (Clerk, Stripe) have unreliable error contracts — TypeScript says they return `{ error }` but they actually `throw` internally. We discovered this with Clerk's `signIn.finalize()` throwing `Error("Cannot finalize sign-in without a created session.")` despite the type signature saying it returns `Promise<{ error: ClerkError | null }>`.

### Rule

**Never call a "dishonest" third-party SDK method directly from a UI component.** Wrap it in a utility that normalizes the error contract.

Dishonest SDKs (known list — add to this as we discover more):
- `@clerk/expo` — `signIn.password()`, `signIn.finalize()`, `signUp.password()`, `signUp.finalize()`, `signUp.verifications.*`
- `@stripe/stripe-react-native` — payment sheet methods (TBD, verify when integrating in M4)

### Pattern

```ts
// packages/utils/src/safe-sdk.ts

/**
 * Wraps a Clerk-style SDK call that claims to return { error } but may throw.
 * Guarantees: returns { data, error } — never throws.
 */
export async function safeClerkCall<T>(
  fn: () => Promise<{ error: T | null }>,
): Promise<{ error: T | Error | null }> {
  try {
    return await fn();
  } catch (thrown: unknown) {
    return { error: thrown instanceof Error ? thrown : new Error(String(thrown)) };
  }
}
```

```tsx
// ✅ Using the wrapper in a screen
import { safeClerkCall } from '@repo/utils';

async function handleSignIn() {
  setLoading(true);
  try {
    const { error: pwError } = await safeClerkCall(() =>
      signIn.password({ identifier: email.trim(), password }),
    );
    if (pwError) {
      showToast('error', pwError.message ?? 'Sign in failed');
      return;
    }

    const { error: finalError } = await safeClerkCall(() => signIn.finalize());
    if (finalError) {
      showToast('error', finalError.message ?? 'Failed to complete sign in');
      return;
    }
  } catch (error: unknown) {
    reportError(error, { screen: 'SignIn', action: 'signIn' });
    showToast('error', 'Sign in failed. Please try again.');
  } finally {
    setLoading(false);
  }
}
```

---

## 13. Request-ID Correlation — End-to-End Tracing

### The Flow

```
Mobile/Web (generates UUID) → X-Request-ID header → NestJS middleware → req.requestId
                                                                       → response X-Request-ID
                                                                       → Logger context
                                                       Sentry breadcrumb ← response header
```

### Client Side (packages/api-client)

The Axios request interceptor in `packages/api-client/src/client.ts` generates a UUID for every outgoing request and attaches it as `X-Request-ID`. The response interceptor reads it back and attaches to Sentry breadcrumbs.

```ts
// ✅ Required interceptor pattern in client.ts
import { randomUUID } from '@repo/utils';

apiClient.interceptors.request.use((config) => {
  config.headers['X-Request-ID'] = randomUUID();
  return config;
});
```

### Server Side (apps/api)

The `RequestIdMiddleware` extracts or generates the ID, attaches to `req`, and echoes it in the response. Applied globally via `AppModule.configure()`.

### Sentry Integration

On the mobile side, after each API response, the interceptor adds a Sentry breadcrumb:

```ts
apiClient.interceptors.response.use(
  (response) => {
    addBreadcrumb({
      category: 'api',
      message: `${response.config.method?.toUpperCase()} ${response.config.url}`,
      data: { requestId: response.headers['x-request-id'], status: response.status },
      level: 'info',
    });
    return response;
  },
  (error) => {
    // Same breadcrumb for failures, with error details
    reportError(error, {
      action: 'apiRequest',
      extra: { requestId: error.config?.headers?.['X-Request-ID'] },
    });
    return Promise.reject(error);
  },
);
```

### Debugging with Request-ID

When a user reports an issue:
1. Find the Sentry event → get the `requestId` from breadcrumbs
2. Search backend logs for `[rid:<requestId>]`
3. Full trace from button press → API call → database query → response
