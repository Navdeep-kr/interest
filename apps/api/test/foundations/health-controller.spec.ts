import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../../src/modules/health/health.controller';
import { HealthService } from '../../src/modules/health/health.service';
import { DatabaseService } from '../../src/database/database.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController Observability Foundations', () => {
  let controller: HealthController;
  let mockDatabaseService: any;

  beforeEach(async () => {
    mockDatabaseService = {
      ping: jest.fn().mockResolvedValue(true),
      getPoolStats: jest.fn().mockReturnValue({ totalCount: 10, idleCount: 8, waitingCount: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('checkLiveness()', () => {
    it('should return 200 OK with ACTIVE zero-location policy guarantee', () => {
      const res = controller.checkLiveness();
      expect(res.status).toBe('ok');
      expect(res.zeroLocationPolicy).toBe('ACTIVE');
      expect(typeof res.uptimeSeconds).toBe('number');
      expect(res.timestamp).toBeDefined();
    });
  });

  describe('checkReadiness()', () => {
    it('should return 200 with database health and pool stats when healthy', async () => {
      const res = await controller.checkReadiness();
      expect(res.status).toBe('ok');
      expect(res.services.database.status).toBe('up');
      expect(res.services.database.pool).toEqual({ totalCount: 10, idleCount: 8, waitingCount: 0 });
      expect(res.services.memory.heapUsedMb).toBeGreaterThan(0);
    });

    it('should throw ServiceUnavailableException (503) when database is down', async () => {
      mockDatabaseService.ping.mockResolvedValueOnce(false);
      await expect(controller.checkReadiness()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
