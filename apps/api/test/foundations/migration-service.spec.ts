import { Test, TestingModule } from '@nestjs/testing';
import { MigrationService } from '../../src/database/migration.service';
import { DatabaseService } from '../../src/database/database.service';

describe('MigrationService Repeatable Schema Migrations', () => {
  let migrationService: MigrationService;
  let mockDatabaseService: any;

  beforeEach(async () => {
    mockDatabaseService = {
      query: jest.fn().mockImplementation((queryText: string, params?: any[]) => {
        if (queryText.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        if (queryText.includes('SELECT pg_try_advisory_lock')) {
          return Promise.resolve({ rows: [{ locked: true }] });
        }
        if (queryText.includes('SELECT pg_advisory_unlock')) {
          return Promise.resolve({ rows: [{ unlocked: true }] });
        }
        if (queryText.includes('SELECT id, name, checksum')) {
          return Promise.resolve({
            rows: [
              {
                id: 1,
                name: '001_initial_schema.sql',
                checksum: 'checksum1',
                executed_at: new Date().toISOString(),
                execution_time_ms: 120,
              },
            ],
            rowCount: 1,
          });
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      }),
      withTransaction: jest.fn().mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
        };
        return callback(mockClient);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    migrationService = module.get<MigrationService>(MigrationService);
  });

  describe('computeChecksum()', () => {
    it('should compute consistent SHA-256 checksum for SQL content', () => {
      const sql = 'CREATE TABLE test (id INT);';
      const hash1 = migrationService.computeChecksum(sql);
      const hash2 = migrationService.computeChecksum(sql);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should produce different checksums for different SQL scripts', () => {
      const hash1 = migrationService.computeChecksum('CREATE TABLE a (id INT);');
      const hash2 = migrationService.computeChecksum('CREATE TABLE b (id INT);');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getAppliedMigrations()', () => {
    it('should return applied migrations ordered by ID', async () => {
      const applied = await migrationService.getAppliedMigrations();
      expect(applied).toHaveLength(1);
      expect(applied[0].name).toBe('001_initial_schema.sql');
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations'),
      );
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY id ASC'),
      );
    });
  });

  describe('getPendingMigrations()', () => {
    it('should identify unapplied migration scripts from disk', async () => {
      const { applied, pending } = await migrationService.getPendingMigrations();
      expect(applied).toContain('001_initial_schema.sql');
      expect(Array.isArray(pending)).toBe(true);
      // Since 002-015 exist on disk, pending should include them
      expect(pending).toContain('002_auth_sessions_and_age_gate.sql');
      expect(pending).toContain('015_core_foundations_roles_idempotency_audit.sql');
      expect(pending).not.toContain('001_initial_schema.sql');
    });
  });

  describe('runMigrations()', () => {
    it('should acquire advisory lock, execute unapplied migrations in transaction, and release lock', async () => {
      const results = await migrationService.runMigrations();
      expect(results.length).toBeGreaterThan(0);
      expect(mockDatabaseService.query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1) AS locked', [987654321]);
      expect(mockDatabaseService.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [987654321]);

      const skipped = results.filter((r) => r.status === 'SKIPPED');
      const applied = results.filter((r) => r.status === 'APPLIED');
      expect(skipped.length).toBe(1); // 001_initial_schema.sql was mocked as applied
      expect(applied.length).toBeGreaterThan(0);
    });

    it('should abort cleanly when advisory lock is already held by another node', async () => {
      mockDatabaseService.query.mockImplementation((queryText: string) => {
        if (queryText.includes('SELECT pg_try_advisory_lock')) {
          return Promise.resolve({ rows: [{ locked: false }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const results = await migrationService.runMigrations();
      expect(results).toEqual([]);
      expect(mockDatabaseService.withTransaction).not.toHaveBeenCalled();
    });
  });
});
