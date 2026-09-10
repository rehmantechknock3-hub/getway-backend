# syntax=docker/dockerfile:1
#
# Mirrors the build/run recipe already proven on Render (render.yaml):
#   pnpm install --frozen-lockfile && pnpm --filter @repo/schemas build && prisma generate
#   && pnpm --filter @repo/api build   →   prisma migrate deploy && node dist/main
#
# Runs from the monorepo root as build context: docker build -f apps/api/Dockerfile .

FROM node:20-alpine AS build
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @repo/schemas build
RUN pnpm --filter @repo/api exec prisma generate
RUN pnpm --filter @repo/api build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

EXPOSE 3001

# `prisma migrate deploy` only applies pending migrations — safe to re-run on every
# container start/scale-out (same idempotency Render's preDeployCommand already relied on).
CMD ["sh", "-c", "pnpm --filter @repo/api exec prisma migrate deploy && node apps/api/dist/main.js"]
