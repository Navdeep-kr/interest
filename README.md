# Interest — The Pure Interest-Driven Short-Video App

> **Core Architectural Principle:** Content discovery, feed ranking, and search are governed **100% by human curiosity and niche alignment**. Geographical borders, physical proximity, city limits, or IP geolocation are **strictly excluded** from recommendation inputs, data models, and database schemas.

---

## 1. Monorepo Structure

```
d:\Interest/
├── apps/
│   ├── mobile/              # React Native Expo App (iOS / Android)
│   │   ├── src/screens/     # FeedScreen, OnboardingScreen, UploadScreen, ProfileScreen
│   │   ├── src/services/    # api.ts (JWT rotation), telemetry.ts (watch stopwatch)
│   │   └── app.json         # Banned location permissions manifest
│   ├── api/                 # NestJS Application API & Vector Engine
│   │   ├── src/common/      # ZeroLocationInterceptor, JwtAuthGuard, Decorators
│   │   ├── src/database/    # PostgreSQL 16 + pgvector migrations (001_initial_schema.sql)
│   │   └── src/modules/     # Auth, Interests, Reels, Feed, Telemetry, Transcode, Storage
│   └── admin/               # Next.js 14 App Router Operations & Moderation Portal
│       ├── app/             # Dashboard, Taxonomy Tree visualizer, Moderation queue
│       └── tailwind.config.js
├── packages/
│   └── shared/              # Domain Models, 512-d Vector Math, Validation, Taxonomy Seeds
│       └── src/             # types.ts, vector-math.ts, taxonomy-seeds.ts, validation.ts
├── infra/
│   ├── docker/              # Docker Compose (PostgreSQL 16 + pgvector, Redis 7, MinIO, API, Worker, Admin)
│   │   ├── docker-compose.yml
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.worker
│   │   └── Dockerfile.admin
│   └── terraform/           # Production AWS Infrastructure (VPC, RDS pgvector, S3, CloudFront, ECS, ElastiCache)
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── .husky/                  # Git commit-msg and pre-commit hooks
├── .github/workflows/       # CI testing and zero-location audit pipeline
├── turbo.json               # Turborepo task pipeline caching
├── commitlint.config.js     # Conventional Commits enforcement
├── .eslintrc.js             # TypeScript linting rules
├── .prettierrc              # Monorepo code formatting
├── .env.example             # Environment variable templates
└── package.json             # Root workspace orchestration
```

---

## 2. Zero-Location Invariants & Enforcement

1. **Client Manifest Audit:**
   - In `apps/mobile/app.json`, `blockedPermissions` blocks all Android and iOS location APIs (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`).
2. **Network Ingress Scrubbing:**
   - `ZeroLocationInterceptor` scrubs headers (`cf-ipcountry`, `x-forwarded-for`, `x-real-ip`, etc.) and masks `req.ip` as `REDACTED_BY_ZERO_LOCATION_POLICY`.
3. **Database Schema Immunity:**
   - The PostgreSQL schema (`001_initial_schema.sql`) contains **zero columns** for latitude, longitude, country, city, or IP addresses.
4. **CI Invariant Assertions:**
   - The GitHub Actions CI pipeline runs an automated check verifying that no geolocation APIs are added to any application code.

---

## 3. Quickstart Guide

### Prerequisites

- Node.js 20+ & npm 10+
- Docker Desktop (for PostgreSQL 16 `pgvector`, Redis 7, and MinIO)

### Step 1: Clone & Install Dependencies

```bash
git clone <repo-url> interest
cd interest
npm install --legacy-peer-deps
```

### Step 2: Start Infrastructure Services

```bash
# Spins up PostgreSQL 16 (pgvector), Redis 7, MinIO, and auto-creates 'interest-reels' bucket
npm run docker:up
```

### Step 3: Run Automated Tests

```bash
npm test
```

Executes unit tests across the vector mathematics library, zero-location interceptor, and feed recommendation engine.

### Step 4: Start Applications

Open separate terminals for each app:

```bash
# 1. Start NestJS Backend API (port 3000)
npm run dev:api

# 2. Start Next.js Admin Portal (port 3001)
npm run dev:admin

# 3. Start Expo Mobile Client
npm run dev:mobile
```

---

## 4. Workspaces & Scripts

| Command               | Action                                                         |
| :-------------------- | :------------------------------------------------------------- |
| `npm run dev:api`     | Runs NestJS API in watch mode (`http://localhost:3000/api/v1`) |
| `npm run dev:admin`   | Runs Next.js Admin Portal (`http://localhost:3001`)            |
| `npm run dev:mobile`  | Launches Expo development server for Android / iOS             |
| `npm run test`        | Runs Jest tests across the monorepo                            |
| `npm run format`      | Auto-formats code with Prettier across all workspaces          |
| `npm run docker:up`   | Starts local Docker Compose cluster                            |
| `npm run docker:down` | Stops local Docker Compose cluster                             |
| `npm run docker:logs` | Streams live logs from all containers                          |

---

## 5. Mathematical Recommendation Model

### Cosine Vector Distance in `pgvector`

Each reel and each user profile has a normalized unit vector $\vec{v} \in \mathbb{R}^{512}$.
Candidate ranking uses the `pgvector` cosine distance operator (`<=>`):

$$\text{CosineSimilarity}(\vec{u}, \vec{r}) = 1 - (\vec{u} \iff \vec{r})$$

### Dynamic In-Session Vector Drift

When users interact with reels, their interest centroid dynamically shifts in real-time:

$$\vec{u}_{t+1} = \text{Normalize}\left(\vec{u}_t + \alpha \cdot \vec{r}\right)$$

Where $\alpha$ (learning rate) is assigned based on engagement telemetry:

- **Quick Skip ($<1.5\text{s}$):** $\alpha = -0.06$ (dampens unwanted topic immediately)
- **Watch Partial ($>1.5\text{s}$):** $\alpha = +0.02$
- **Watch Complete ($\ge 90\%$):** $\alpha = +0.07$
- **Loop / Replay:** $\alpha = +0.12$
- **Like / Save:** $\alpha = +0.15 \text{ to } +0.18$

Feeds are delivered with an $80/20$ split: **80%** core vector matches and **20%** $\epsilon$-greedy exploration slots from adjacent taxonomy nodes to prevent algorithmic echo chambers.
