import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom Performance Metrics & SLO Gauges
const feedLatency = new Trend('feed_page_latency_ms');
const telemetryLatency = new Trend('telemetry_ping_latency_ms');
const feedSuccessRate = new Rate('feed_success_rate');
const zeroLocationSanityRate = new Rate('zero_location_compliance_rate');
const redisCacheHitRate = new Rate('redis_cache_hit_rate');
const totalReelsScrolled = new Counter('total_reels_scrolled');

// 10,000 Concurrent Virtual Users (VUs) Stress Profile
export const options = {
  scenarios: {
    infinite_feed_load: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '1m', target: 1000 },  // Warmup stage: Ramp to 1,000 VUs
        { duration: '3m', target: 5000 },  // Normal high traffic: Ramp to 5,000 VUs
        { duration: '5m', target: 10000 }, // Peak traffic spike: Ramp to 10,000 VUs
        { duration: '2m', target: 10000 }, // Sustained peak pressure
        { duration: '1m', target: 0 },     // Graceful rampdown
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // p95 latency must stay strictly below 120ms under 10k VUs
    'feed_page_latency_ms': ['p(95)<120', 'p(99)<250'],
    'telemetry_ping_latency_ms': ['p(95)<50', 'p(99)<100'],
    // 99.99% availability (error rate < 0.01%)
    'feed_success_rate': ['rate>0.9999'],
    // 100% Zero-Location compliance: zero geo coordinates or location leaks allowed
    'zero_location_compliance_rate': ['rate>0.9999'],
    'http_req_failed': ['rate<0.0001'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';

// Pool of test user authentication tokens
const MOCK_TOKENS = [
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_1_synthesizers',
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_2_pottery',
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_3_quantum',
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_4_specialty_coffee',
  'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user_5_deep_learning',
];

export default function () {
  const token = MOCK_TOKENS[Math.floor(Math.random() * MOCK_TOKENS.length)];
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': token,
    'Accept': 'application/json',
    'X-Client-Platform': 'mobile-ios',
  };

  let cursor = null;
  const pagesToScroll = Math.floor(Math.random() * 5) + 3; // 3 to 7 pages per user session

  for (let page = 0; page < pagesToScroll; page++) {
    // 1. Fetch Batch of Reels (Cursor-based infinite pagination)
    const feedUrl = cursor
      ? `${BASE_URL}/api/v1/feed?limit=10&cursor=${encodeURIComponent(cursor)}`
      : `${BASE_URL}/api/v1/feed?limit=10`;

    const feedStart = Date.now();
    const feedRes = http.get(feedUrl, {
      headers,
      tags: { name: 'GET_feed' },
    });
    const feedDuration = Date.now() - feedStart;

    feedLatency.add(feedDuration);

    const isSuccess = check(feedRes, {
      'status is 200': (r) => r.status === 200,
      'has items array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.items) && body.items.length > 0;
        } catch {
          return false;
        }
      },
      'has zero geo metadata in response': (r) => {
        // Strict invariant check: ensure no location/geo tags exist in response payload
        const raw = r.body || '';
        const forbiddenKeys = ['"latitude"', '"longitude"', '"city"', '"countryCode"', '"location"'];
        return !forbiddenKeys.some((k) => raw.includes(k));
      },
    });

    feedSuccessRate.add(isSuccess);
    zeroLocationSanityRate.add(
      feedRes.body &&
      !feedRes.body.includes('"latitude"') &&
      !feedRes.body.includes('"longitude"') &&
      !feedRes.body.includes('"countryCode"')
    );

    // Track Redis cache header if present
    const cacheHeader = feedRes.headers['X-Cache'] || feedRes.headers['x-cache'];
    redisCacheHitRate.add(cacheHeader === 'HIT');

    if (!isSuccess) {
      sleep(1);
      break;
    }

    const payload = JSON.parse(feedRes.body);
    const reels = payload.items || [];
    cursor = payload.nextCursor || null;
    totalReelsScrolled.add(reels.length);

    // 2. Simulate User Watching Reels in Batch
    for (const reel of reels.slice(0, 3)) {
      // Dwell time: 2 to 6 seconds per reel
      const watchTimeSeconds = Math.floor(Math.random() * 5) + 2;
      sleep(watchTimeSeconds * 0.1); // Scaled for test execution pace

      // Telemetry heartbeat ping
      const telemetryPayload = JSON.stringify({
        reelId: reel.id,
        durationSeconds: reel.durationSeconds || 15,
        watchedSeconds: watchTimeSeconds,
        completionRate: Math.min(1.0, watchTimeSeconds / (reel.durationSeconds || 15)),
        interaction: Math.random() < 0.25 ? 'LIKE' : undefined,
      });

      const telStart = Date.now();
      const telRes = http.post(`${BASE_URL}/api/v1/telemetry/watch-time`, telemetryPayload, {
        headers,
        tags: { name: 'POST_telemetry_watch_time' },
      });
      telemetryLatency.add(Date.now() - telStart);

      check(telRes, {
        'telemetry accepted (200 or 202)': (r) => r.status === 200 || r.status === 202,
      });
    }

    // Prefetch pause before triggering next infinite-scroll page
    sleep(1);
    if (!cursor) break;
  }
}
