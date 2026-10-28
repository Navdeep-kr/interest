import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  private circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private lastFailureTime = 0;
  private readonly CIRCUIT_RESET_TIMEOUT_MS = 10000;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>(
      'DATABASE_URL',
      'postgresql://interest_user:interest_pass@localhost:5432/interest_db',
    );

    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 250,
    });

    try {
      const client = await this.pool.connect();
      this.logger.log('Connected to PostgreSQL successfully.');
      this.circuitState = 'CLOSED';
      client.release();
    } catch (err: any) {
      this.circuitState = 'OPEN';
      this.lastFailureTime = Date.now();
      this.logger.warn(`PostgreSQL connection not ready at startup (Circuit Breaker OPEN): ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('PostgreSQL connection pool closed.');
    }
  }

  /**
   * Formats a TypeScript number array into pgvector string representation: '[x, y, z]'
   */
  public static vectorToPg(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }

  /**
   * Parses a pgvector string '[x, y, z]' into TypeScript number array
   */
  public static pgToVector(pgVectorStr: string): number[] {
    if (!pgVectorStr) return [];
    if (Array.isArray(pgVectorStr)) return pgVectorStr;
    const clean = pgVectorStr.replace(/[\[\]]/g, '');
    if (!clean.trim()) return [];
    return clean.split(',').map((val) => {
      const trimmed = val.trim();
      return trimmed === '' ? NaN : Number(trimmed);
    });
  }

  /**
   * Executes a parameterized query on the pool with circuit breaking and slow query detection.
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    // 1. Fast-fail if circuit breaker is OPEN or probe in progress
    if (this.circuitState === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime < this.CIRCUIT_RESET_TIMEOUT_MS) {
        throw new Error('Database circuit breaker is OPEN (fast-fail during database outage)');
      }
      // Single probe attempt in HALF_OPEN state
      this.circuitState = 'HALF_OPEN';
      this.lastFailureTime = now;
    } else if (this.circuitState === 'HALF_OPEN') {
      throw new Error('Database circuit breaker is HALF_OPEN (probe already in progress)');
    }

    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const elapsed = Date.now() - start;
      if (elapsed > 100) {
        this.logger.warn(`SLOW QUERY (${elapsed}ms): ${text.replace(/\s+/g, ' ').trim().slice(0, 150)}...`);
      }
      this.circuitState = 'CLOSED';
      return res;
    } catch (err: any) {
      this.circuitState = 'OPEN';
      this.lastFailureTime = Date.now();
      this.logger.error(`Query execution failed (${Date.now() - start}ms) [Circuit Breaker tripped to OPEN]: ${err.message}`);
      throw err;
    }
  }

  /**
   * Retrieves a dedicated client for multi-statement transactions.
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Safe transaction runner with automatic BEGIN, COMMIT, ROLLBACK, and client release.
   */
  async withTransaction<T>(
    work: (client: PoolClient) => Promise<T>,
    isolationLevel: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' = 'READ COMMITTED',
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        this.logger.error(`Error during transaction rollback: ${rollbackErr.message}`);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health ping to verify database liveness.
   */
  async ping(): Promise<boolean> {
    try {
      const res = await this.pool.query('SELECT 1 AS alive');
      return res.rows?.[0]?.alive === 1;
    } catch (err) {
      this.logger.error(`Database ping failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Returns current pool connection metrics.
   */
  getPoolStats() {
    if (!this.pool) {
      return { totalCount: 0, idleCount: 0, waitingCount: 0 };
    }
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}
