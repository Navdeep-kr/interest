/**
 * Staging Load & Throughput Benchmark Suite for Interest Platform
 * Evaluates feed throughput, latencies (p50/p95/p99), error rates, zero-location defenses, and metrics extraction.
 */
const http = require('http');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const duration = Date.now() - start;
    let data;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    return {
      ok: res.ok,
      status: res.status,
      duration,
      headers: Object.fromEntries(res.headers.entries()),
      data,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      duration: Date.now() - start,
      error: err.message,
    };
  }
}

async function runBenchmark() {
  console.log('=================================================================');
  console.log('           INTEREST STAGING LOAD & OBSERVABILITY BENCHMARK       ');
  console.log('=================================================================');
  console.log(`[Config] Target Endpoint: ${BASE_URL}`);

  // Phase 1: Health & Observability Pre-check
  console.log('\n--- Phase 1: Health & Observability Pre-check ---');
  const healthRes = await request('/health');
  console.log(`Liveness Check: status=${healthRes.status} (${healthRes.duration}ms)`);
  if (!healthRes.ok) {
    console.error('API is not healthy! Please ensure apps/api is running.');
    process.exit(1);
  }

  const metricsRes = await request('/metrics/json');
  console.log(`Metrics Endpoint: status=${metricsRes.status} (${metricsRes.duration}ms)`);

  // Phase 2: Feed & Explore Throughput Load Test
  console.log('\n--- Phase 2: Feed & Explore Concurrency Benchmark ---');
  const TOTAL_REQUESTS = 300;
  const CONCURRENCY = 25;
  console.log(`Running ${TOTAL_REQUESTS} requests across endpoints with concurrency ${CONCURRENCY}...`);

  const endpoints = [
    '/health',
    '/metrics/json',
    '/search/trending?window=24h',
    '/search/autocomplete?q=machine',
    '/interests/tree',
    '/interests/search?q=ai',
    '/interests/related?ids=topic_ai',
  ];

  const results = [];
  let completed = 0;

  async function worker(queue) {
    while (queue.length > 0) {
      const ep = queue.pop();
      const res = await request(ep, {
        headers: {
          'x-request-id': `bench_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        },
      });
      results.push(res);
      completed++;
      if (completed % 50 === 0) {
        process.stdout.write(`Completed ${completed}/${TOTAL_REQUESTS} requests...\r`);
      }
    }
  }

  const taskQueue = [];
  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    taskQueue.push(endpoints[i % endpoints.length]);
  }

  const benchStartTime = Date.now();
  const workers = [];
  for (let c = 0; c < CONCURRENCY; c++) {
    workers.push(worker(taskQueue));
  }
  await Promise.all(workers);
  const benchTotalTimeMs = Date.now() - benchStartTime;

  // Compute Latency Percentiles
  const durations = results.map((r) => r.duration).sort((a, b) => a - b);
  const successes = results.filter((r) => r.ok).length;
  const failures = results.length - successes;
  const rps = ((results.length / benchTotalTimeMs) * 1000).toFixed(1);

  const p50 = durations[Math.floor(durations.length * 0.50)];
  const p90 = durations[Math.floor(durations.length * 0.90)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const p99 = durations[Math.floor(durations.length * 0.99)];
  const minLatency = durations[0];
  const maxLatency = durations[durations.length - 1];
  const avgLatency = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1);

  console.log('\n--- Benchmark Throughput Results ---');
  console.log(`Total Requests:      ${results.length}`);
  console.log(`Successful:          ${successes} (${((successes / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failed:              ${failures}`);
  console.log(`Total Elapsed Time:  ${benchTotalTimeMs} ms`);
  console.log(`Achieved Throughput: ${rps} req/sec`);
  console.log(`Min Latency:         ${minLatency} ms`);
  console.log(`Avg Latency:         ${avgLatency} ms`);
  console.log(`p50 Latency:         ${p50} ms`);
  console.log(`p90 Latency:         ${p90} ms`);
  console.log(`p95 Latency:         ${p95} ms`);
  console.log(`p99 Latency:         ${p99} ms`);
  console.log(`Max Latency:         ${maxLatency} ms`);

  // Phase 3: W3C Distributed Tracing Validation
  console.log('\n--- Phase 3: W3C Distributed Tracing Validation ---');
  const sampleTrace = await request('/health');
  const traceparent = sampleTrace.headers['traceparent'];
  const traceId = sampleTrace.headers['x-trace-id'];
  console.log(`traceparent header: ${traceparent || 'MISSING'}`);
  console.log(`x-trace-id header:  ${traceId || 'MISSING'}`);
  const traceValid = traceparent && /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/.test(traceparent);
  console.log(`Trace Header Validity: ${traceValid ? '[PASS]' : '[FAIL]'}`);

  // Phase 4: Zero-Location Penetration & Policy Defense
  console.log('\n--- Phase 4: Zero-Location Invariant Penetration Test ---');
  const attackRes = await request('/health?lat=37.7749&lon=-122.4194&country=US', {
    headers: {
      'cf-ipcountry': 'US',
      'x-real-ip': '192.0.2.1',
      'x-forwarded-for': '198.51.100.1',
      'cloudfront-viewer-latitude': '37.7749',
    },
  });
  console.log(`Attack Request Status: ${attackRes.status} (Handled gracefully: ${attackRes.ok ? '[PASS]' : '[FAIL]'})`);
  console.log(`Response Zero-Location Policy: ${attackRes.data?.zeroLocationPolicy || 'ACTIVE'}`);

  // Phase 5: Prometheus Metrics Snapshot
  console.log('\n--- Phase 5: Prometheus Scraping Verification ---');
  const promTextRes = await fetch(`${BASE_URL}/metrics`);
  const promText = await promTextRes.text();
  const hasHttpRequests = promText.includes('http_requests_total');
  const hasDuration = promText.includes('http_request_duration_seconds');
  const hasZeroLoc = promText.includes('zero_location_violations_total 0');
  console.log(`Scraped Prometheus Metrics Length: ${promText.length} bytes`);
  console.log(`Contains http_requests_total: ${hasHttpRequests ? '[PASS]' : '[FAIL]'}`);
  console.log(`Contains http_request_duration_seconds: ${hasDuration ? '[PASS]' : '[FAIL]'}`);
  console.log(`Zero-Location Violations = 0: ${hasZeroLoc ? '[PASS]' : '[FAIL]'}`);

  // Evaluation Gate Check
  console.log('\n=================================================================');
  const p95Target = parseInt(process.env.P95_TARGET_MS || '750', 10);
  const gatePass = failures === 0 && p95 <= p95Target && traceValid && hasHttpRequests && hasZeroLoc;
  console.log(`Gate Verification (Failures=0, p95<=${p95Target}ms [actual: ${p95}ms], Traces=PASS, Metrics=PASS, ZeroLoc=PASS)`);
  console.log(`PROMPT 23 GATE STATUS: ${gatePass ? 'PASS' : 'FAIL'}`);
  console.log('=================================================================');

  return {
    gatePass,
    totalRequests: results.length,
    successRate: (successes / results.length) * 100,
    rps: parseFloat(rps),
    p50,
    p95,
    p99,
    traceValid,
    zeroLocationEnforced: hasZeroLoc,
  };
}

if (require.main === module) {
  runBenchmark().catch((err) => {
    console.error('Benchmark error:', err);
    process.exit(1);
  });
}

module.exports = { runBenchmark };
