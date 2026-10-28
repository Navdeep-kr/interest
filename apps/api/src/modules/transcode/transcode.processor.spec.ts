import { TranscodeProcessor } from './transcode.processor';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../storage/storage.service';
import { ReelStatus } from '@shared/types';
import * as fs from 'fs';
import * as path from 'path';

describe('TranscodeProcessor (FFmpeg Multi-Bitrate & Privacy Stripping Worker)', () => {
  let processor: TranscodeProcessor;
  let mockDatabaseService: any;
  let mockStorageService: any;

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT vector::text FROM interests')) {
          const fakeVec = new Array(512).fill(0);
          fakeVec[0] = 1.0;
          return Promise.resolve({
            rows: [{ vector: `[${fakeVec.join(',')}]` }],
          });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
    };

    mockStorageService = {
      downloadFile: jest.fn().mockResolvedValue(undefined),
      uploadHlsDirectory: jest
        .fn()
        .mockResolvedValue('https://cdn.example.com/reels/reel-1/hls/master.m3u8'),
      getPublicUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
    };

    processor = new TranscodeProcessor(
      mockDatabaseService as any,
      mockStorageService as any,
    );
  });

  const mockJob: any = {
    id: 'job-123',
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: {
      reelId: '11111111-1111-4111-a111-000000000001',
      s3RawKey: 'uploads/raw/reel-1_sample.mp4',
      primaryInterestId: '22222222-2222-4222-a222-000000000001',
      interestTagIds: ['22222222-2222-4222-a222-000000000002'],
      coverTimestampSeconds: 2.0,
    },
  };

  it('should transcode to 4-tier HLS, strip metadata, and publish live reel', async () => {
    const result = await processor.process(mockJob);

    expect(result.success).toBe(true);
    expect(result.hlsUrl).toContain('master.m3u8');

    // Verify DB update calls
    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reels SET status = $1'),
      [ReelStatus.PROCESSING, mockJob.data.reelId],
    );

    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reels'),
      expect.arrayContaining([
        ReelStatus.PUBLISHED,
        'https://cdn.example.com/reels/reel-1/hls/master.m3u8',
        'https://cdn.example.com/reels/11111111-1111-4111-a111-000000000001/hls/thumb.jpg',
        'https://cdn.example.com/reels/11111111-1111-4111-a111-000000000001/hls/audio.aac',
      ]),
    );

    // Verify S3 HLS directory upload was called
    expect(mockStorageService.uploadHlsDirectory).toHaveBeenCalledWith(
      expect.any(String),
      `reels/${mockJob.data.reelId}/hls`,
    );
  });

  it('should mark reel as failed and rethrow for BullMQ retry if processing throws', async () => {
    mockStorageService.uploadHlsDirectory.mockRejectedValueOnce(
      new Error('S3 Connection Timeout'),
    );

    await expect(processor.process(mockJob)).rejects.toThrow('S3 Connection Timeout');

    // Verify failed status record in database
    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE reels'),
      [ReelStatus.FAILED, 'S3 Connection Timeout', mockJob.data.reelId],
    );
  });
});
