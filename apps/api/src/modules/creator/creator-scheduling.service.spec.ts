import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreatorSchedulingService } from './creator-scheduling.service';
import { DatabaseService } from '../../database/database.service';

describe('CreatorSchedulingService', () => {
  let service: CreatorSchedulingService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorSchedulingService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<CreatorSchedulingService>(CreatorSchedulingService);
  });

  it('should reject schedule times in the past', async () => {
    const pastDate = new Date(Date.now() - 60000).toISOString();
    await expect(
      service.scheduleReel('user-1', { reelId: 'reel-1', scheduledAt: pastDate }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should schedule a reel in the future', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ id: 'reel-1', creator_id: 'user-1', status: 'PENDING_UPLOAD' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await service.scheduleReel('user-1', { reelId: 'reel-1', scheduledAt: futureDate });
    expect(res.scheduled).toBe(true);
    expect(res.reelId).toBe('reel-1');
  });

  it('should publish due scheduled reels', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ id: 'reel-due-1' }, { id: 'reel-due-2' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await service.publishDueScheduledReels();
    expect(res.publishedCount).toBe(2);
    expect(res.publishedIds).toEqual(['reel-due-1', 'reel-due-2']);
  });
});
