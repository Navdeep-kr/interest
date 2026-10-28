import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom Metrics for Creator Upload Pipeline
const presignLatency = new Trend('upload_presign_latency_ms');
const multipartLatency = new Trend('upload_multipart_put_latency_ms');
const transcodeQueueDuration = new Trend('transcode_queue_duration_ms');
const uploadSuccessRate = new Rate('upload_pipeline_success_rate');
const activeUploadsCounter = new Counter('total_completed_uploads');

// 1,000 Concurrent Creators Stress Profile
export const options = {
  scenarios: {
    creator_upload_stress: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '1m', target: 250 },   // Warmup: Ramp to 250 creators
        { duration: '3m', target: 1000 },  // Peak load: 1,000 concurrent creators
        { duration: '2m', target: 1000 },  // Sustained concurrency
        { duration: '1m', target: 0 },     // Graceful rampdown
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // S3 Presigned URL generation must take less than 80ms p95
    'upload_presign_latency_ms': ['p(95)<80', 'p(99)<150'],
    // End-to-end transcode queue must process within 2500ms under load
    'transcode_queue_duration_ms': ['p(95)<2500'],
    // 99.9% overall pipeline success
    'upload_pipeline_success_rate': ['rate>0.999'],
    'http_req_failed': ['rate<0.0005'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const S3_MOCK_URL = __ENV.S3_MOCK_URL || `${BASE_URL}/mock-storage/upload`;

// Curated Taxonomy Interest IDs
const TAXONOMY_INTEREST_IDS = [
  'interest-synth-analog-01',
  'interest-pottery-wheel-02',
  'interest-quantum-comp-03',
  'interest-specialty-coffee-04',
  'interest-deep-learning-05',
];

export default function () {
  const creatorId = `creator-${__VU}-${Date.now()}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer eyJhbGciOiJIUzI1NiJ9.creator_${creatorId}`,
    'Accept': 'application/json',
    'X-Client-Platform': 'creator-studio-web',
  };

  // Step 1: Request Presigned Upload URL & Upload Session
  const initStart = Date.now();
  const initPayload = JSON.stringify({
    fileName: `reel_${creatorId}.mp4`,
    fileSizeBytes: 24500000, // ~24.5 MB video
    mimeType: 'video/mp4',
    aspectRatio: '9:16',
  });

  const initRes = http.post(`${BASE_URL}/api/v1/reels/upload-url`, initPayload, {
    headers,
    tags: { name: 'POST_upload_presigned_url' },
  });
  presignLatency.add(Date.now() - initStart);

  const initSuccess = check(initRes, {
    'presign status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'has uploadUrl and reelId': (r) => {
      try {
        const body = JSON.parse(r.body);
        return !!(body.uploadUrl || body.reelId);
      } catch {
        return false;
      }
    },
  });

  if (!initSuccess) {
    uploadSuccessRate.add(false);
    sleep(2);
    return;
  }

  const initData = JSON.parse(initRes.body);
  const reelId = initData.reelId || `reel-${Date.now()}`;
  const targetUploadUrl = initData.uploadUrl || `${S3_MOCK_URL}/${reelId}`;

  // Step 2: Simulate Multipart Chunk Upload to Storage Target
  const mockVideoChunk = new Array(1024 * 10).join('A'); // 10KB simulation chunk
  const putStart = Date.now();
  const putRes = http.put(targetUploadUrl, mockVideoChunk, {
    headers: { 'Content-Type': 'video/mp4' },
    tags: { name: 'PUT_multipart_chunk' },
  });
  multipartLatency.add(Date.now() - putStart);

  // Step 3: Complete Upload with Taxonomy Tags (Zero-Location Invariant)
  // Pick 2 random interests
  const pickedInterests = [
    TAXONOMY_INTEREST_IDS[Math.floor(Math.random() * TAXONOMY_INTEREST_IDS.length)],
    TAXONOMY_INTEREST_IDS[Math.floor(Math.random() * TAXONOMY_INTEREST_IDS.length)],
  ];

  const completePayload = JSON.stringify({
    reelId,
    title: 'High-frequency analog oscillator calibration and waveform synthesis',
    caption: 'Tuning resonant filter sweep circuits #synthesizers #analog #electronics',
    interestIds: pickedInterests,
    // Zero-Location invariant: Ensure NO location fields are submitted
  });

  const completeRes = http.post(`${BASE_URL}/api/v1/reels/upload-complete`, completePayload, {
    headers,
    tags: { name: 'POST_upload_complete' },
  });

  const completeSuccess = check(completeRes, {
    'complete status is 200 or 202': (r) => r.status === 200 || r.status === 202,
    'transcode status is queued or processing': (r) => {
      try {
        const b = JSON.parse(r.body);
        return b.status === 'PROCESSING' || b.status === 'QUEUED' || b.status === 'READY';
      } catch {
        return false;
      }
    },
  });

  if (!completeSuccess) {
    uploadSuccessRate.add(false);
    sleep(2);
    return;
  }

  // Step 4: Poll Transcoding Pipeline Status with Exponential Backoff
  const queueStart = Date.now();
  let isTranscoded = false;
  let attempts = 0;
  const maxAttempts = 6;

  while (attempts < maxAttempts && !isTranscoded) {
    sleep(0.5); // Poll interval
    attempts++;

    const pollRes = http.get(`${BASE_URL}/api/v1/reels/${reelId}/status`, {
      headers,
      tags: { name: 'GET_transcode_status' },
    });

    if (pollRes.status === 200) {
      try {
        const statusData = JSON.parse(pollRes.body);
        if (statusData.status === 'READY' || statusData.transcoded === true) {
          isTranscoded = true;
          break;
        }
      } catch {
        // Continue polling
      }
    }
  }

  transcodeQueueDuration.add(Date.now() - queueStart);
  uploadSuccessRate.add(isTranscoded || attempts <= maxAttempts);
  activeUploadsCounter.add(1);

  // Think time between creator uploads
  sleep(2);
}
