# syntax=docker/dockerfile:1

# Backend service image. Build context is the monorepo ROOT (see docker-compose.yml).
FROM node:24-alpine AS base
# Install pnpm globally (no corepack version resolution, available to any user at runtime).
RUN npm install -g pnpm@11.21.0
WORKDIR /repo

# ---- deps: install the workspace from the frozen lockfile ----
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/cms-core/package.json ./packages/cms-core/package.json
RUN pnpm install --frozen-lockfile --fetch-retries=5 --fetch-timeout=600000

# ---- build + deploy: compile to dist/, then emit a self-contained prod bundle ----
FROM base AS build
ENV CI=true
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps ./apps
COPY --from=deps /repo/packages ./packages
COPY --from=deps /repo/package.json ./package.json
COPY --from=deps /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/backend ./apps/backend
COPY packages/cms-core ./packages/cms-core
RUN pnpm --filter @dacho/backend build \
  && pnpm --filter @dacho/backend deploy --legacy --prod /out/backend

# ---- runner: just the deployed bundle ----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodejs
COPY --from=build --chown=nodejs:nodejs /out/backend ./
USER nodejs
EXPOSE 4000
ENV PORT=4000
CMD ["node", "dist/index.js"]
