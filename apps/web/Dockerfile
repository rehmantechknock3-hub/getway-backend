# syntax=docker/dockerfile:1
#
# Mirrors the build/run recipe already proven on Render (render.yaml):
#   pnpm install --frozen-lockfile && pnpm --filter @repo/schemas build && pnpm --filter @repo/web build
#   →   next start -p $PORT
#
# NEXT_PUBLIC_* vars are inlined at BUILD time, so they must be passed as --build-arg
# (see deploy/08-apprunner-web.sh) — setting them only as a runtime env var does nothing.
#
# Runs from the monorepo root as build context: docker build -f apps/web/Dockerfile .

FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @repo/schemas build
RUN pnpm --filter @repo/web build

FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app /app

EXPOSE 3000

CMD ["sh", "-c", "pnpm --filter @repo/web exec next start -p ${PORT:-3000}"]
