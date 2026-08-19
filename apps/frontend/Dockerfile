# syntax=docker/dockerfile:1

# Fused CMS + site image. Build context is the monorepo ROOT (see docker-compose.yml).
FROM node:24-alpine AS base
# Install pnpm globally (no corepack version resolution, available to any user at runtime).
RUN npm install -g pnpm@11.21.0
WORKDIR /repo

# ---- deps: full install for the build ----
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/cms-core/package.json ./packages/cms-core/package.json
RUN pnpm install --frozen-lockfile --fetch-retries=5 --fetch-timeout=600000

# ---- build: next build (standalone output) ----
FROM base AS build
# Payload SSG (generateStaticParams) queries the DB during `next build`, so the
# config's required env must be present here. DATABASE_URL points at the compose
# Postgres via the host network (see docker-compose build.network).
ARG PAYLOAD_SECRET
ARG DATABASE_URL
ENV PAYLOAD_SECRET=$PAYLOAD_SECRET
ENV DATABASE_URL=$DATABASE_URL
RUN apk add --no-cache libc6-compat
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps ./apps
COPY --from=deps /repo/packages ./packages
COPY --from=deps /repo/package.json ./package.json
COPY --from=deps /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY . .
RUN pnpm --filter @dacho/frontend build

# ---- runner ----
FROM base AS runner
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /repo

# manifests for a fresh prod install (payload pulls tsx, so the .ts config loads)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/cms-core/package.json ./packages/cms-core/package.json

# config source + cms-core (payload migrate resolves these via @payload-config)
COPY --from=build /repo/apps/frontend/src ./apps/frontend/src
COPY --from=build /repo/apps/frontend/tsconfig.json ./apps/frontend/tsconfig.json
COPY --from=build /repo/packages/cms-core ./packages/cms-core

# fresh prod install — correct symlinks, no per-package node_modules COPY
RUN pnpm install --prod --filter @dacho/frontend --frozen-lockfile --fetch-retries=5 --fetch-timeout=600000

# standalone server (self-contained) + static + public
COPY --from=build /repo/apps/frontend/.next/standalone ./standalone/
COPY --from=build /repo/apps/frontend/.next/static ./standalone/.next/static
COPY --from=build /repo/apps/frontend/public ./standalone/public
RUN mkdir -p /repo/standalone/public/media

COPY --from=build /repo/apps/frontend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x /repo/docker-entrypoint.sh

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /repo
USER nextjs
EXPOSE 3000
ENTRYPOINT ["/repo/docker-entrypoint.sh"]
