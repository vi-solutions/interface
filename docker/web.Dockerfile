# ── builder ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json packages/shared/
COPY apps/web/package*.json apps/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

# NEXT_PUBLIC_* vars are inlined at build time
ARG NEXT_PUBLIC_API_URL=https://api.interfaceenviro.ca
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/web

# ── runner ────────────────────────────────────────────────────────────────────
# Standalone output is self-contained — no npm install needed
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Standalone output mirrors monorepo structure from outputFileTracingRoot
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
# server.js is placed at apps/web/server.js within the standalone output
CMD ["node", "apps/web/server.js"]
