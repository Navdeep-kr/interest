import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DatabaseService } from './database.service';

export interface MigrationRecord {
  id: number;
  name: string;
  checksum: string;
  executed_at: string;
  execution_time_ms: number;
}

export interface MigrationResult {
  name: string;
  status: 'APPLIED' | 'SKIPPED' | 'FAILED';
  executionTimeMs?: number;
  error?: string;
}

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);
  private readonly advisoryLockId = 987654321;

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Computes SHA-256 checksum of migration SQL string.
   */
  public computeChecksum(sql: string): string {
    return crypto.createHash('sha256').update(sql.trim()).digest('hex');
  }

  /**
   * Resolves the absolute directory path where migration SQL files reside.
   */
  public getMigrationsDir(): string {
    // Check relative to current file or source
    const candidates = [
      path.join(__dirname, 'migrations'),
      path.join(__dirname, '..', '..', 'src', 'database', 'migrations'),
      path.join(process.cwd(), 'src', 'database', 'migrations'),
      path.join(process.cwd(), 'apps', 'api', 'src', 'database', 'migrations'),
    ];

    for (const dir of candidates) {
      if (fs.existsSync(dir)) {
        return dir;
      }
    }
    return path.join(__dirname, 'migrations');
  }

  /**
   * Ensures the schema_migrations ledger exists.
   */
  public async ensureMigrationsTable(): Promise<void> {
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_time_ms INT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(name);
    `);
  }

  /**
   * Retrieves all applied migration records from schema_migrations.
   */
  public async getAppliedMigrations(): Promise<MigrationRecord[]> {
    await this.ensureMigrationsTable();
    const result = await this.databaseService.query<MigrationRecord>(
      'SELECT id, name, checksum, executed_at, execution_time_ms FROM schema_migrations ORDER BY id ASC',
    );
    return result.rows;
  }

  /**
   * Inspects pending migrations.
   */
  public async getPendingMigrations(): Promise<{ applied: string[]; pending: string[] }> {
    const applied = await this.getAppliedMigrations();
    const appliedNames = new Set(applied.map((m) => m.name));

    const migrationsDir = this.getMigrationsDir();
    if (!fs.existsSync(migrationsDir)) {
      return { applied: Array.from(appliedNames), pending: [] };
    }

    const allFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const pending = allFiles.filter((file) => !appliedNames.has(file));
    return { applied: Array.from(appliedNames), pending };
  }

  /**
   * Runs all pending migrations in alphabetical order within transactional boundaries.
   */
  public async runMigrations(): Promise<MigrationResult[]> {
    this.logger.log('Starting automated migration cycle...');
    await this.ensureMigrationsTable();

    // Acquire PostgreSQL session advisory lock to ensure single-instance runner execution
    let lockAcquired = false;
    try {
      const lockRes = await this.databaseService.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [this.advisoryLockId],
      );
      lockAcquired = lockRes.rows?.[0]?.locked === true;
      if (!lockAcquired) {
        this.logger.warn('Another migration process currently holds the advisory lock. Aborting duplicate execution.');
        return [];
      }

      const applied = await this.getAppliedMigrations();
      const appliedMap = new Map(applied.map((m) => [m.name, m.checksum]));

      const migrationsDir = this.getMigrationsDir();
      if (!fs.existsSync(migrationsDir)) {
        this.logger.warn(`Migrations directory not found at: ${migrationsDir}`);
        return [];
      }

      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith('.sql'))
        .sort();

      const results: MigrationResult[] = [];

      for (const fileName of migrationFiles) {
        const filePath = path.join(migrationsDir, fileName);
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        const checksum = this.computeChecksum(sqlContent);

        if (appliedMap.has(fileName)) {
          const appliedChecksum = appliedMap.get(fileName);
          if (appliedChecksum !== checksum) {
            this.logger.warn(
              `Migration ${fileName} checksum mismatch! Applied: ${appliedChecksum}, Current: ${checksum}`,
            );
          }
          results.push({ name: fileName, status: 'SKIPPED' });
          continue;
        }

        const startTime = Date.now();
        this.logger.log(`Applying migration: ${fileName}...`);

        try {
          await this.databaseService.withTransaction(async (client) => {
            // Execute raw SQL file statements
            await client.query(sqlContent);

            const durationMs = Date.now() - startTime;
            await client.query(
              `INSERT INTO schema_migrations (name, checksum, execution_time_ms)
               VALUES ($1, $2, $3)`,
              [fileName, checksum, durationMs],
            );
          });

          const totalDuration = Date.now() - startTime;
          this.logger.log(`✓ Migration ${fileName} successfully applied in ${totalDuration}ms`);
          results.push({
            name: fileName,
            status: 'APPLIED',
            executionTimeMs: totalDuration,
          });
        } catch (err) {
          this.logger.error(`✗ Migration ${fileName} failed: ${err.message}`, err.stack);
          results.push({
            name: fileName,
            status: 'FAILED',
            error: err.message,
          });
          throw new Error(`Migration ${fileName} failed to apply: ${err.message}`);
        }
      }

      this.logger.log(`Migration cycle completed. ${results.filter((r) => r.status === 'APPLIED').length} applied, ${results.filter((r) => r.status === 'SKIPPED').length} skipped.`);
      return results;
    } finally {
      if (lockAcquired) {
        try {
          await this.databaseService.query('SELECT pg_advisory_unlock($1)', [this.advisoryLockId]);
        } catch (unlockErr) {
          this.logger.error(`Failed to release advisory lock: ${unlockErr.message}`);
        }
      }
    }
  }
}
