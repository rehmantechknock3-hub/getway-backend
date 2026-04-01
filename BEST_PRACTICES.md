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

```ts
// ✅
private readonly logger = new Logger(BookingsService.name);

async findOne(id: string) {
  const booking = await this.prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new NotFoundException(`Booking ${id} not found`);
  return booking;
}
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
