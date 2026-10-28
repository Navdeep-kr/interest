import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface HttpRequestMetric {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  // In-memory counters and buckets
  private requestCounts: Map<string, number> = new Map();
  private durationBuckets: Map<string, number[]> = new Map();
  private zeroLocationViolations = 0;
  private queueMetrics: Map<string, { waiting: number; active: number; completed: number; failed: number }> = new Map();

  // Standard Prometheus latency buckets (seconds): 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0
  private readonly BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0];

  constructor(private readonly databaseService: DatabaseService) {
    // Initialize default queue tracker
    this.queueMetrics.set('video-transcode', { waiting: 0, active: 0, completed: 0, failed: 0 });
    this.queueMetrics.set('notifications', { waiting: 0, active: 0, completed: 0, failed: 0 });
  }

  /**
   * Records an HTTP request execution.
   */
  recordHttpRequest(metric: HttpRequestMetric): void {
    const sanitizedPath = this.normalizePath(metric.path);
    const key = `${metric.method}_${sanitizedPath}_${metric.statusCode}`;
    const current = this.requestCounts.get(key) || 0;
    this.requestCounts.set(key, current + 1);

    const durationSec = metric.durationMs / 1000;
    const bucketKey = `${metric.method}_${sanitizedPath}`;
    if (!this.durationBuckets.has(bucketKey)) {
      this.durationBuckets.set(bucketKey, []);
    }
    const durations = this.durationBuckets.get(bucketKey)!;
    durations.push(durationSec);

    // Keep memory bounded to last 10,000 samples per endpoint
    if (durations.length > 10000) {
      durations.shift();
    }
  }

  /**
   * Records a zero-location security policy alert.
   */
  recordZeroLocationViolation(): void {
    this.zeroLocationViolations++;
    this.logger.error('CRITICAL ALERT: Zero-location violation detected!');
  }

  /**
   * Updates queue metrics from BullMQ workers.
   */
  updateQueueStats(queueName: string, stats: { waiting: number; active: number; completed: number; failed: number }): void {
    this.queueMetrics.set(queueName, stats);
  }

  /**
   * Normalizes URLs to prevent high cardinality metric explosion.
   */
  private normalizePath(path: string): string {
    return path
      .split('?')[0]
      .replace(/\/reels\/[0-9a-fA-F-]{10,}/g, '/reels/:id')
      .replace(/\/users\/[0-9a-fA-F-]{10,}/g, '/users/:id')
      .replace(/\/communities\/[0-9a-fA-F-]{10,}/g, '/communities/:id')
      .replace(/\/chat\/conversations\/[0-9a-fA-F-]{10,}/g, '/chat/conversations/:id');
  }

  /**
   * Returns JSON-formatted metric snapshots for dashboards.
   */
  async getMetricsSnapshot(): Promise<Record<string, any>> {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const pool = this.databaseService.getPoolStats();

    // Calculate aggregated p50, p95, p99 latencies
    const allDurations: number[] = [];
    this.durationBuckets.forEach((durations) => allDurations.push(...durations));
    allDurations.sort((a, b) => a - b);

    const p50 = allDurations.length ? allDurations[Math.floor(allDurations.length * 0.50)] * 1000 : 0;
    const p95 = allDurations.length ? allDurations[Math.floor(allDurations.length * 0.95)] * 1000 : 0;
    const p99 = allDurations.length ? allDurations[Math.floor(allDurations.length * 0.99)] * 1000 : 0;

    let totalRequests = 0;
    let totalErrors = 0;
    this.requestCounts.forEach((count, key) => {
      totalRequests += count;
      const statusCode = parseInt(key.split('_').pop() || '200', 10);
      if (statusCode >= 400) totalErrors += count;
    });

    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      system: {
        memory: {
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
          rssMb: Math.round(mem.rss / 1024 / 1024),
        },
        cpu: {
          userMicroseconds: cpu.user,
          systemMicroseconds: cpu.system,
        },
      },
      http: {
        totalRequests,
        totalErrors,
        errorRatePercent: parseFloat(errorRate.toFixed(2)),
        latenciesMs: {
          p50: Math.round(p50),
          p95: Math.round(p95),
          p99: Math.round(p99),
        },
      },
      database: {
        pool,
      },
      queues: Object.fromEntries(this.queueMetrics.entries()),
      security: {
        zeroLocationViolations: this.zeroLocationViolations,
      },
    };
  }

  /**
   * Produces OpenMetrics / Prometheus text standard format output.
   */
  async getPrometheusMetrics(): Promise<string> {
    const mem = process.memoryUsage();
    const pool = this.databaseService.getPoolStats();
    const lines: string[] = [];

    // HELP & TYPE annotations
    lines.push('# HELP http_requests_total Total number of HTTP requests processed');
    lines.push('# TYPE http_requests_total counter');
    this.requestCounts.forEach((count, key) => {
      const parts = key.split('_');
      const statusCode = parts.pop();
      const method = parts.shift();
      const path = parts.join('_');
      lines.push(`http_requests_total{method="${method}",path="${path}",status="${statusCode}"} ${count}`);
    });

    lines.push('');
    lines.push('# HELP http_request_duration_seconds HTTP request latency histogram');
    lines.push('# TYPE http_request_duration_seconds histogram');
    this.durationBuckets.forEach((durations, key) => {
      const [method, path] = key.split('_');
      let sum = 0;
      const counts = new Array(this.BUCKETS.length).fill(0);

      durations.forEach((d) => {
        sum += d;
        for (let i = 0; i < this.BUCKETS.length; i++) {
          if (d <= this.BUCKETS[i]) counts[i]++;
        }
      });

      for (let i = 0; i < this.BUCKETS.length; i++) {
        lines.push(`http_request_duration_seconds_bucket{method="${method}",path="${path}",le="${this.BUCKETS[i]}"} ${counts[i]}`);
      }
      lines.push(`http_request_duration_seconds_bucket{method="${method}",path="${path}",le="+Inf"} ${durations.length}`);
      lines.push(`http_request_duration_seconds_sum{method="${method}",path="${path}"} ${sum.toFixed(4)}`);
      lines.push(`http_request_duration_seconds_count{method="${method}",path="${path}"} ${durations.length}`);
    });

    lines.push('');
    lines.push('# HELP db_pool_connections_total Database connection pool metrics');
    lines.push('# TYPE db_pool_connections_total gauge');
    lines.push(`db_pool_connections_total{state="total"} ${pool.totalCount}`);
    lines.push(`db_pool_connections_total{state="idle"} ${pool.idleCount}`);
    lines.push(`db_pool_connections_total{state="waiting"} ${pool.waitingCount}`);

    lines.push('');
    lines.push('# HELP queue_jobs_total BullMQ queue status gauges');
    lines.push('# TYPE queue_jobs_total gauge');
    this.queueMetrics.forEach((stats, queue) => {
      lines.push(`queue_jobs_total{queue="${queue}",state="waiting"} ${stats.waiting}`);
      lines.push(`queue_jobs_total{queue="${queue}",state="active"} ${stats.active}`);
      lines.push(`queue_jobs_total{queue="${queue}",state="completed"} ${stats.completed}`);
      lines.push(`queue_jobs_total{queue="${queue}",state="failed"} ${stats.failed}`);
    });

    lines.push('');
    lines.push('# HELP nodejs_memory_bytes Node.js memory consumption');
    lines.push('# TYPE nodejs_memory_bytes gauge');
    lines.push(`nodejs_memory_bytes{type="heap_used"} ${mem.heapUsed}`);
    lines.push(`nodejs_memory_bytes{type="heap_total"} ${mem.heapTotal}`);
    lines.push(`nodejs_memory_bytes{type="rss"} ${mem.rss}`);

    lines.push('');
    lines.push('# HELP zero_location_violations_total Count of attempted GPS/geolocation telemetry submissions');
    lines.push('# TYPE zero_location_violations_total counter');
    lines.push(`zero_location_violations_total ${this.zeroLocationViolations}`);

    return lines.join('\n') + '\n';
  }
}
