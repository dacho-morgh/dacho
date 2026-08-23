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
# Payload's config requires these at import time (fail-fast, no silent
# defaults), so the build stage must have them set — but thanks to buildSafe()
# the build no longer needs a REACHABLE database. Placeholders are enough; real
# values are injected at runtime via compose env / mounted secrets.
ARG PAYLOAD_SECRET=build-time-placeholder
ARG DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
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

# Operational scripts (admin bootstrap, service account, content seed). Run them
# with Payload's own TS loader — `payload run scripts/<name>.ts` — because tsx is
# a devDependency and is absent from this production install.
COPY --from=build /repo/apps/frontend/scripts ./apps/frontend/scripts

# fresh prod install — install the frontend AND its workspace dep cms-core so
# `payload migrate` can resolve the config's own deps (sharp, payload, plugins).
RUN pnpm install --prod --filter @dacho/frontend --filter @dacho/cms-core --frozen-lockfile --fetch-retries=5 --fetch-timeout=600000

# Build output + public. `next start` runs against the complete prod
# node_modules above (not the standalone tracer output, which only partially
# traces symlinked deps like @swc/helpers — missing esm/).
COPY --from=build /repo/apps/frontend/.next ./apps/frontend/.next
COPY --from=build /repo/apps/frontend/public ./apps/frontend/public
COPY --from=build /repo/apps/frontend/next.config.ts ./apps/frontend/next.config.ts
COPY --from=build /repo/apps/frontend/redirects.ts ./apps/frontend/redirects.ts
RUN mkdir -p /repo/apps/frontend/public/media

# Copy entrypoint from context (not the build stage) so edits to it don't
# invalidate the cached `next build` layer.
COPY apps/frontend/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x /repo/docker-entrypoint.sh

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /repo
USER nextjs
EXPOSE 3000
ENTRYPOINT ["/repo/docker-entrypoint.sh"]
