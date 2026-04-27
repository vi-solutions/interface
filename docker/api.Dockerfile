# ── builder ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package*.json ./
COPY packages/shared/package*.json packages/shared/
COPY apps/api/package*.json apps/api/
RUN npm ci

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

# Build shared first, then API (nest build also copies SQL migration assets)
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install production deps only (npm workspaces will symlink @interface/shared)
COPY package*.json ./
COPY packages/shared/package*.json packages/shared/
COPY apps/api/package*.json apps/api/
RUN npm ci --omit=dev

# Copy built outputs
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/dist apps/api/dist

# Uploads dir (mounted as volume in production)
RUN mkdir -p apps/uploads

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
