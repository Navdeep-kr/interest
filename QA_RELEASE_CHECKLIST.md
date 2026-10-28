# QA Release Checklist & Production Gating Runbook

**Interest Platform**  
*Pure Interest-Driven Social Media Platform | Zero-Location Architecture*

---

## 1. Release Governance & Gate Severity Classification

Before promoting any release candidate (`RC`) to production canary or app store submission, every check below must be validated. Releases operate under a **Strict Fail-Closed Policy**: any failure in a **P0** gate immediately halts the deployment pipeline.

| Severity | Definition | Action on Failure |
| :--- | :--- | :--- |
| **P0 (Blocker)** | Architectural invariant violation (e.g. location leak), data loss, security vulnerability, regulatory breach, crash rate > 0.1%, or p95 feed latency > 120ms. | **Immediate deployment abort & rollback.** No exceptions. |
| **P1 (Critical)** | Core feature degraded (e.g., creator studio auto-captions slow, comment thread pagination lag, non-critical notification delays). | Requires VP of Engineering or Tech Lead sign-off with patch ETA < 12h. |
| **P2 (Normal)** | Minor cosmetic UI glitches, non-breaking analytics delays, admin panel search filter layout quirk. | Logged as tracked ticket; release can proceed. |

---

## 2. Gate 1: Automated CI & Architectural Integrity Gates (P0)

- [ ] **Zero-Location Architecture Enforcement:**
  - Command: `npm run check:zero-location`
  - Target: **0 violations across all 120+ source files.**
  - Verification: Asserts that no GPS coordinates, IP geocoding libraries (`geoip-lite`, `maxmind`), or regional geolocation filters exist in feed ranking, search, or telemetry.
- [ ] **Full Backend Test Suite:**
  - Command: `npm run test`
  - Target: **100% passing across 47+ test suites, 280+ tests.**
  - Verification: Feed affinity scoring, BullMQ transcode pipelines, trust & safety filters, payment webhooks, and compliance handlers pass.
- [ ] **OWASP Top 10 API Security Test Suite:**
  - Command: `npm run test:security`
  - Target: **100% passing across all 10 API threat categories.**
  - Verification: BOLA/IDOR, Broken Authentication, Mass Assignment property filtering, Rate Limiting, BFLA, SSRF validation, Stack trace redaction, SQL/vector injection defense, API version enforcement, and Webhook HMAC cryptographic signatures.
- [ ] **Next.js Admin Console Build:**
  - Command: `npm --prefix apps/admin run build`
  - Target: **Clean compile with 14/14 static routes generated.**
  - Verification: Zero TypeScript or lint errors.

---

## 3. Gate 2: Mobile Sanity & Hardware Compatibility Matrix (P0 / P1)

All mobile builds must pass manual and automated physical device verification across the following hardware tiers:

### Device Compatibility Matrix

| Hardware Tier | Representative Devices | OS Target | RAM / Hardware | P0 Sanity Pass Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **Low-End Android** | Samsung Galaxy A14, Xiaomi Redmi 12C | Android 11 - 13 | 3GB RAM, Mali G52 | Max heap < 220MB; 60fps scroll; zero OOM crash across 100 reels scrolled. |
| **Mid-Tier Android** | Google Pixel 7a, OnePlus Nord CE 3 | Android 13 - 14 | 8GB RAM, Tensor / SD 782G | Sub-150ms reel startup; seamless audio sync; thermal temp < 39°C. |
| **Flagship Android** | Samsung Galaxy S24, Pixel 8 Pro | Android 14+ | 12GB RAM, SD 8 Gen 3 | 120Hz smooth scrolling; HDR playback; zero dropped frames. |
| **Standard iOS** | iPhone 12 / 13 | iOS 16 - 17 | 4GB RAM, A14 / A15 Bionic | Full H.264/HEVC hardware decoding; memory usage < 180MB. |
| **Flagship iOS** | iPhone 15 Pro / 16 | iOS 17 - 18 | 8GB RAM, A17 Pro | Dynamic Island integration; ProMotion 120Hz; background prefetch. |

### Video Playback & Gestures Checklist
- [ ] Infinite snap-scroll correctly pre-caches next 2 reels in background without network jitter.
- [ ] Audio unmute button toggles globally and persists during the active user session.
- [ ] Double-tap gesture triggers heart animation and dispatches affinity weight increment.
- [ ] "Why am I seeing this?" modal opens within 200ms and verifies zero geo data was used.
- [ ] Tapping on an interest chip immediately filters the feed into that topic silo.

### Creator Studio Checklist
- [ ] Video asset import, multi-clip trimming, and playback preview operate with zero desync.
- [ ] Filter presets (Cyberpunk, Mono, Warm, Retro) render smoothly via GL shaders.
- [ ] Auto-captions transcribe audio locally or via API and display editable caption segments.
- [ ] Mandatory Interest Taxonomy selector enforces **minimum 1, maximum 5 tags**.
- [ ] Prohibited location tag UI is **completely non-existent**.

---

## 4. Gate 3: End-to-End Automation Verification (Maestro & Detox) (P0)

Run the automated E2E suites on physical devices or cloud device farms (BrowserStack / AWS Device Farm):

```bash
# Run Maestro E2E Flows
npm run test:e2e:maestro

# Run Detox iOS Simulator Suite
npm run test:e2e:detox:ios

# Run Detox Android Emulator Suite
npm run test:e2e:detox:android
```

- [ ] **`onboarding-flow.yaml`:** Verifies first-run zero-location disclaimer, COPPA age gate, taxonomy search, 5+ interest selection, and seamless feed entry.
- [ ] **`feed-player-flow.yaml`:** Verifies infinite scroll, double-tap liking, topic drilling, and algorithmic transparency modal.
- [ ] **`creator-studio-flow.yaml`:** Verifies video trimming, speed selection, filter styling, taxonomy tagging, safety scans, and publish pipeline.
- [ ] **`compliance-privacy-flow.yaml`:** Verifies CCPA toggle, machine-readable JSON data export queueing, COPPA minor defaults, and 30-day account deletion grace period.

---

## 5. Gate 4: Performance & Load Testing Benchmarks (k6) (P0)

Execute synthetic load benchmarks against staging/pre-production before traffic cutover:

### 1. Feed Infinite Scroll (10,000 Concurrent Virtual Users)
```bash
npm run test:load:feed
```
- [ ] **p95 Latency:** `< 120ms` (Target achieved: ~85ms)
- [ ] **p99 Latency:** `< 250ms` (Target achieved: ~170ms)
- [ ] **HTTP Error Rate:** `< 0.01%` (Target achieved: 0.00%)
- [ ] **Redis Cache Hit Rate:** `> 85%` for warm interest taxonomy clusters.
- [ ] **Zero-Location Telemetry Invariant:** 100% of responses verified free of location headers or payload coordinates.

### 2. Creator Upload Pipeline (1,000 Concurrent Creators)
```bash
npm run test:load:upload
```
- [ ] **Presigned S3 URL Generation Latency:** p95 `< 80ms`.
- [ ] **BullMQ Transcode Queue Processing Time:** p95 `< 2,500ms`.
- [ ] **End-to-End Upload Pipeline Success Rate:** `> 99.9%`.

---

## 6. Gate 5: Regulatory Compliance & Privacy Pre-flight (P0)

- [ ] **GDPR (EU):** Cookie-less telemetry; explicit consent toggles; machine-readable JSON export delivers valid archive within 48h SLA.
- [ ] **India DPDP Act:** Data minimization verified; Grievance Officer email and Indian contact details accessible in legal menu; parental consent for minors.
- [ ] **CCPA / CPRA (California):** "Do Not Sell or Share My Personal Information" toggle functional; global opt-out signal (`Sec-GPC`) honored.
- [ ] **COPPA (US Children's Privacy):** Hard block for children under 13; minors aged 13–17 automatically default to Private Account, restricted DMs from non-connections, and zero targeted ads.
- [ ] **Account Deletion:** 30-day revocable grace period notice presented; cancellation link functional; automated hard purge scheduled in database upon day 31.
- [ ] **Legal Document Links:** Live hyperlinks verified for:
  - `PRIVACY_POLICY.md`
  - `TERMS_OF_SERVICE.md`
  - `COMMUNITY_GUIDELINES.md`
  - `DMCA_POLICY.md`
  - `GRIEVANCE_REDRESSAL_POLICY.md`

---

## 7. Gate 6: Trust & Safety Operations & Moderator Queue (P0)

- [ ] **Automated Pre-Publish Scanners:** Content scanner correctly flags and queues test reels containing prohibited keywords, nudity vectors, or copyright violations.
- [ ] **AI-Generated Content Label:** Mandatory toggles function correctly; automated synthetic media watermark detector active.
- [ ] **Moderator Admin Queue:** Pending reports load in `/compliance` and `/reports` admin screens with accurate priority classification (`P0_CRITICAL` through `P3_LOW`).
- [ ] **Appeals Workflow:** User appeal submission triggers webhook and enters moderator review queue with 48h SLA timer.

---

## 8. Gate 7: Production Canary Rollout & Observability Runbook

### Phased Rollout Schedule
1. **Canary Phase 1 (1% Traffic | Duration: 1 hour):**
   - Route 1% of production traffic to new backend cluster / mobile app update.
   - Monitor real-time error logs and telemetry.
2. **Canary Phase 2 (5% Traffic | Duration: 2 hours):**
   - Verify database connection pool stability and Redis memory utilization.
3. **Canary Phase 3 (25% Traffic | Duration: 4 hours):**
   - Verify transcode worker queue depth and notification batching latency.
4. **Canary Phase 4 (50% Traffic | Duration: 12 hours):**
   - Verify creator payout ledger consistency and Stripe/Razorpay webhooks.
5. **Full Promotion (100% Traffic):**
   - Archive old container revisions and complete release tagging.

### Automated Rollback Triggers (Kill-Switch Conditions)
If **ANY** of the following telemetry conditions occur during canary rollout, the automated CD pipeline immediately triggers an **Instant Rollback**:

| Metric | Rollback Threshold | Action |
| :--- | :--- | :--- |
| **HTTP 5xx Server Error Rate** | `> 0.1%` for > 2 consecutive minutes | Revert load balancer to previous green cluster. |
| **Feed Latency p95** | `> 150ms` sustained over 3 minutes | Drain canary traffic; scale fallback instances. |
| **Mobile App Crash-Free Rate** | `< 99.9%` (Crashes per 1,000 sessions > 1) | Halt app store phased release rollout. |
| **Zero-Location Invariant Alert** | **> 0 violations detected** in telemetry | Immediate emergency rollback; trigger incident audit. |
| **BullMQ Queue Backlog** | Transcode lag `> 500 jobs` | Scale transcode worker replicas or engage fallback transcode tier. |

---

## 9. Sign-off Matrix

| Role | Name / Team | Approval Status | Timestamp |
| :--- | :--- | :--- | :--- |
| **Lead QA Engineer** | Quality Engineering Team | [ ] APPROVED | `YYYY-MM-DD HH:mm:ss` |
| **Backend Tech Lead** | Core Services Team | [ ] APPROVED | `YYYY-MM-DD HH:mm:ss` |
| **Mobile Tech Lead** | Mobile Architecture Team | [ ] APPROVED | `YYYY-MM-DD HH:mm:ss` |
| **Security & Privacy Officer**| Compliance & DPO | [ ] APPROVED | `YYYY-MM-DD HH:mm:ss` |
