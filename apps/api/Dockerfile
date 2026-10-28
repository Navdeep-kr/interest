# =============================================================================
# Stage 1: Monorepo Dependency Resolution & Build Stage
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ libc6-compat

# Copy Monorepo manifests for optimal Docker layer caching
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install dependencies across workspaces
RUN npm ci --legacy-peer-deps

# Copy shared package source and compile
COPY packages/shared/ ./packages/shared/
WORKDIR /app/packages/shared
RUN npm run build

# Copy API source code and build
WORKDIR /app/apps/api
COPY apps/api/tsconfig*.json ./
COPY apps/api/src/ ./src/
RUN npm run build

# =============================================================================
# Stage 2: Production Distroless / Hardened Alpine Runner
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install dumb-init for proper PID 1 signal forwarding and curl for healthcheck
RUN apk add --no-cache dumb-init curl

# Create unprivileged system user & group
RUN addgroup -S interest && adduser -S interest -G interest

# Copy workspace dependencies
COPY package.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install only production dependencies
WORKDIR /app
RUN npm ci --only=production --legacy-peer-deps

# Copy built distribution from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Set ownership to unprivileged user
RUN chown -R interest:interest /app

USER interest

WORKDIR /app/apps/api

EXPOSE 3000

# Container Healthcheck probing /api/v1/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
