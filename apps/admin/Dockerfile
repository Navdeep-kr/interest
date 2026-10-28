# =============================================================================
# Stage 1: Build Next.js 14 Admin Panel
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Monorepo structure setup
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/

RUN npm ci --legacy-peer-deps

COPY packages/shared/ ./packages/shared/
WORKDIR /app/packages/shared
RUN npm run build

WORKDIR /app/apps/admin
COPY apps/admin/ ./

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# =============================================================================
# Stage 2: Production Hardened Alpine Runner
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache dumb-init curl
RUN addgroup -S interest && adduser -S interest -G interest

COPY package.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/admin/package.json ./apps/admin/

WORKDIR /app
RUN npm ci --only=production --legacy-peer-deps

COPY --from=builder /app/apps/admin/.next ./apps/admin/.next
COPY --from=builder /app/apps/admin/public ./apps/admin/public 2>/dev/null || true

RUN chown -R interest:interest /app

USER interest

WORKDIR /app/apps/admin

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3001/ || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
