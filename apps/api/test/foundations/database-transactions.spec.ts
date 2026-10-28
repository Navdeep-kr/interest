import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../src/database/database.service';

describe('DatabaseService Transaction & Pool Foundations', () => {
  let databaseService: DatabaseService;
  let mockClient: any;
  let mockPool: any;

  beforeEach(async () => {
    mockClient = {
      query: jest.fn().mockImplementation((queryText: string) => {
        if (queryText.includes('SELECT 1')) {
          return Promise.resolve({ rows: [{ alive: 1 }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
      release: jest.fn(),
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn().mockImplementation((queryText: string) => {
        if (queryText.includes('SELECT 1')) {
          return Promise.resolve({ rows: [{ alive: 1 }] });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
      end: jest.fn().mockResolvedValue(undefined),
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('postgresql://test_user:test_pass@localhost:5432/test_db'),
          },
        },
      ],
    }).compile();

    databaseService = module.get<DatabaseService>(DatabaseService);
    // Inject mock pool
    (databaseService as any).pool = mockPool;
  });

  describe('withTransaction()', () => {
    it('should successfully execute callback and commit transaction', async () => {
      const result = await databaseService.withTransaction(async (client) => {
        await client.query('INSERT INTO audit_log (action) VALUES ($1)', ['CREATE_USER']);
        return { success: true, count: 1 };
      });

      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED');
      expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO audit_log (action) VALUES ($1)', ['CREATE_USER']);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true, count: 1 });
    });

    it('should automatically rollback transaction and rethrow on error', async () => {
      const actionPromise = databaseService.withTransaction(async (client) => {
        await client.query('UPDATE balance SET amount = 0 WHERE id = 1');
        throw new Error('Database constraint violated');
      });

      await expect(actionPromise).rejects.toThrow('Database constraint violated');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('should support explicit SERIALIZABLE isolation level', async () => {
      await databaseService.withTransaction(async (client) => {
        return 'done';
      }, 'SERIALIZABLE');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('ping() & pool metrics', () => {
    it('should return true when database is healthy', async () => {
      const isHealthy = await databaseService.ping();
      expect(isHealthy).toBe(true);
    });

    it('should return false when database query throws', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Connection refused'));
      const isHealthy = await databaseService.ping();
      expect(isHealthy).toBe(false);
    });

    it('should report accurate pool statistics', () => {
      const stats = databaseService.getPoolStats();
      expect(stats).toEqual({
        totalCount: 5,
        idleCount: 3,
        waitingCount: 0,
      });
    });
  });
});
