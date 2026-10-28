import { ReelsService } from './reels.service';
import { DatabaseService } from '../../database/database.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReelStatus, ReelVisibility } from '@shared/types';

describe('ReelsService - Upload Pipeline & Recommendation Explanation', () => {
  let service: ReelsService;
  let mockDatabaseService: any;
  let mockStorageService: any;
  let mockAiSuggester: any;
  let mockQueue: any;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };

    mockDatabaseService = {
      query: jest.fn(),
      getClient: jest.fn().mockResolvedValue(mockClient),
    };

    mockStorageService = {
      getPresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.example.com/single-upload'),
      initiateMultipartUpload: jest.fn().mockResolvedValue('upload-xyz-123'),
      getPresignedPartUrl: jest.fn().mockResolvedValue('https://s3.example.com/part-1'),
      completeMultipartUpload: jest.fn().mockResolvedValue('https://cdn.example.com/video.mp4'),
    };

    mockAiSuggester = {
      suggestInterests: jest.fn().mockResolvedValue([]),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    service = new ReelsService(
      mockDatabaseService as any,
      mockStorageService as any,
      mockAiSuggester as any,
      mockQueue as any,
    );
  });

  const reelId = 'reel-1234';
  const userId = 'user-5678';

  describe('Multipart Upload Pipeline', () => {
    it('should initiate multipart upload and calculate expected 5MB parts', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

      const res = await service.initiateMultipartUpload(userId, {
        filename: 'my_skate_session.mp4',
        contentType: 'video/mp4',
        fileSizeBytes: 24 * 1024 * 1024, // 24 MB -> 5 parts of 5MB
      });

      expect(res.uploadId).toBe('upload-xyz-123');
      expect(res.s3Key).toContain('my_skate_session.mp4');
      expect(res.partSize).toBe(5 * 1024 * 1024);
      expect(res.expectedParts).toBe(5);
      expect(mockStorageService.initiateMultipartUpload).toHaveBeenCalled();
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO reels'),
        expect.any(Array),
      );
    });

    it('should generate presigned part URLs for verified owner', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({
          rows: [{ id: reelId, creator_id: userId, raw_s3_key: 'uploads/raw/test.mp4' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const parts = await service.getMultipartPartUrls(userId, {
        reelId,
        uploadId: 'upload-xyz-123',
        s3Key: 'uploads/raw/test.mp4',
        partNumbers: [1, 2],
      });

      expect(parts).toHaveLength(2);
      expect(parts[0].partNumber).toBe(1);
      expect(parts[0].url).toBe('https://s3.example.com/part-1');
      expect(mockStorageService.getPresignedPartUrl).toHaveBeenCalledTimes(2);
    });

    it('should finalize reel and dispatch BullMQ transcode job with 3 retries', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: reelId, creator_id: userId, raw_s3_key: 'uploads/raw/test.mp4' }],
      });

      const res = await service.finalizeReel(userId, {
        reelId,
        title: 'Calisthenics Planche Mechanics',
        caption: 'Detailed scapular protraction cues',
        hashtags: ['calisthenics', 'planche'],
        primaryInterestId: '11111111-1111-4111-a111-000000000001',
        interestTagIds: ['11111111-1111-4111-a111-000000000002'],
        visibility: ReelVisibility.PUBLIC,
        coverTimestampSeconds: 2.5,
      });

      expect(res.status).toBe(ReelStatus.PROCESSING);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'transcode',
        expect.objectContaining({
          reelId,
          primaryInterestId: '11111111-1111-4111-a111-000000000001',
          coverTimestampSeconds: 2.5,
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 3000 },
        }),
      );
    });

    it('should reject finalizing reel with more than 5 total interest tags', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ id: reelId, creator_id: userId }],
      });

      await expect(
        service.finalizeReel(userId, {
          reelId,
          title: 'Too many tags',
          primaryInterestId: 'tag-1',
          interestTagIds: ['tag-2', 'tag-3', 'tag-4', 'tag-5', 'tag-6'], // 6 total
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Real-Time Status Tracking', () => {
    it('should return processing status and progress percentage', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: reelId,
            status: ReelStatus.PROCESSING,
            hls_master_url: null,
            thumbnail_url: null,
            error_reason: null,
            updated_at: new Date().toISOString(),
          },
        ],
      });

      const statusRes = await service.getReelStatus(userId, reelId);

      expect(statusRes.status).toBe(ReelStatus.PROCESSING);
      expect(statusRes.progressPercent).toBe(75);
      expect(statusRes.errorReason).toBeNull();
    });

    it('should return published status at 100% progress', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            id: reelId,
            status: ReelStatus.PUBLISHED,
            hls_master_url: 'https://cdn.example.com/master.m3u8',
            thumbnail_url: 'https://cdn.example.com/thumb.jpg',
            error_reason: null,
            updated_at: new Date().toISOString(),
          },
        ],
      });

      const statusRes = await service.getReelStatus(userId, reelId);

      expect(statusRes.status).toBe(ReelStatus.PUBLISHED);
      expect(statusRes.progressPercent).toBe(100);
      expect(statusRes.hlsMasterUrl).toBe('https://cdn.example.com/master.m3u8');
    });
  });

  describe('"Why am I seeing this?" API', () => {
    it('should explain recommendation when user follows the primary interest', async () => {
      const userVec = new Array(512).fill(0);
      userVec[0] = 1.0;
      const reelVec = new Array(512).fill(0);
      reelVec[0] = 1.0;

      mockDatabaseService.query.mockImplementation((sql: string) => {
        if (sql.includes('FROM reels r')) {
          return Promise.resolve({
            rows: [
              {
                id: reelId,
                title: 'Mastering TypeScript Generics',
                embedding: `[${reelVec.join(',')}]`,
                primary_interest_id: 'interest-ts',
                primary_interest_slug: 'typescript',
                primary_interest_title: 'TypeScript',
              },
            ],
          });
        }

        if (sql.includes('FROM reel_interests ri')) {
          return Promise.resolve({
            rows: [
              {
                id: 'interest-ts',
                slug: 'typescript',
                title: 'TypeScript',
                is_primary: true,
                affinity_weight: '2.50',
                interaction_count: 14,
                user_follows: true,
              },
            ],
          });
        }

        if (sql.includes('FROM users WHERE id')) {
          return Promise.resolve({
            rows: [{ interest_vector: `[${userVec.join(',')}]` }],
          });
        }

        return Promise.resolve({ rows: [] });
      });

      const explanation = await service.explainReel(userId, reelId);

      expect(explanation).toBeDefined();
      expect(explanation.reelId).toBe(reelId);
      expect(explanation.primaryInterest.title).toBe('TypeScript');
      expect(explanation.userAffinityWeight).toBe(2.5);
      expect(explanation.vectorSimilarityPercent).toBe(100);
      expect(explanation.rationale).toContain('TypeScript');
      expect(explanation.rationale).toContain('2.5x');
      expect(explanation.zeroLocationGuarantee).toContain('Zero-Location Guarantee');
      expect(explanation.zeroLocationGuarantee).toContain('never tracks, stores, or utilizes GPS');

      const dataWithoutGuarantee = { ...explanation, zeroLocationGuarantee: undefined };
      const jsonStr = JSON.stringify(dataWithoutGuarantee).toLowerCase();
      expect(jsonStr).not.toContain('latitude');
      expect(jsonStr).not.toContain('longitude');
      expect(jsonStr).not.toContain('country');
      expect(jsonStr).not.toContain('city');
      expect(jsonStr).not.toContain('ip_address');
    });

    it('should throw NotFoundException if reel does not exist', async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.explainReel(userId, 'non-existent-reel')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
