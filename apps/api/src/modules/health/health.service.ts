import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  zeroLocationPolicy: 'ACTIVE';
  services: {
    database: {
      status: 'up' | 'down';
      latencyMs?: number;
      pool?: { totalCount: number; idleCount: number; waitingCount: number };
    };
    memory: {
      heapUsedMb: number;
      heapTotalMb: number;
      rssMb: number;
    };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Lightweight liveness check (does not hit downstream dependencies).
   */
  getLiveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      zeroLocationPolicy: 'ACTIVE' as const,
    };
  }

  /**
   * Deep readiness check verifying PostgreSQL database connection pool.
   */
  async getReadiness(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let dbStatus: 'up' | 'down' = 'down';
    let dbLatency = 0;

    try {
      const isAlive = await this.databaseService.ping();
      dbLatency = Date.now() - startTime;
      dbStatus = isAlive ? 'up' : 'down';
    } catch (err) {
      this.logger.error(`Readiness check failed for PostgreSQL: ${err.message}`);
      dbStatus = 'down';
    }

    const memoryUsage = process.memoryUsage();
    const overallStatus: 'ok' | 'degraded' | 'down' = dbStatus === 'up' ? 'ok' : 'down';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      zeroLocationPolicy: 'ACTIVE',
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatency,
          pool: this.databaseService.getPoolStats(),
        },
        memory: {
          heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        },
      },
    };
  }
}
