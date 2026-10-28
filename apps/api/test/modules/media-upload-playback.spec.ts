import { Test, TestingModule } from '@nestjs/testing';
import { ReelsService } from '../../src/modules/reels/reels.service';
import { TranscodeProcessor, TranscodeJobPayload } from '../../src/modules/transcode/transcode.processor';
import { StorageService } from '../../src/modules/storage/storage.service';
import { DatabaseService } from '../../src/database/database.service';
import { ContentScannerService } from '../../src/modules/safety/content-scanner.service';
import { AiInterestSuggesterService } from '../../src/modules/reels/ai-interest-suggester.service';
import { RedisCounterService } from '../../src/modules/interactions/redis-counter.service';
import { MentionsService } from '../../src/modules/interactions/mentions.service';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ReelStatus, ReelVisibility, AiLabelType } from '@shared/types';
import { Job } from 'bullmq';

describe('Prompt 9 — Production Media Upload, Transcoding & Playback Pipeline', () => {
  let reelsService: ReelsService;
  let transcodeProcessor: TranscodeProcessor;
  let mockDb: any;
  let mockStorage: any;
  let mockScanner: any;
  let mockQueue: any;
  let mockClient: any;
  let mockRedisCounters: any;
  let mockMentions: any;

  const userA_Creator = '11111111-1111-1111-1111-111111111111'; // User A (Uploader)
  const userB_AuthorizedViewer = '22222222-2222-2222-2222-222222222222'; // User B (Follower/Viewer)
  const userC_UnauthorizedViewer = '33333333-3333-3333-3333-333333333333'; // User C (Blocked/Unauthorized)

  const primaryInterestId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const secondaryInterestId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(async () => {
    mockClient = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [] }),
      release: jest.fn(),
    };

    mockDb = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
      getClient: jest.fn().mockResolvedValue(mockClient),
      withTransaction: jest.fn().mockImplementation((cb) => cb(mockClient)),
    };

    mockStorage = {
      getPresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.interest.test/upload-single'),
      initiateMultipartUpload: jest.fn().mockResolvedValue('s3-upload-id-999'),
      getPresignedPartUrl: jest.fn().mockImplementation((key, uploadId, partNum) =>
        Promise.resolve(`https://s3.interest.test/parts/${partNum}?uploadId=${uploadId}`),
      ),
      completeMultipartUpload: jest.fn().mockResolvedValue('https://cdn.interest.app/uploads/raw/assembled.mp4'),
      abortMultipartUpload: jest.fn().mockResolvedValue(undefined),
      downloadFile: jest.fn().mockResolvedValue(undefined),
      uploadHlsDirectory: jest.fn().mockResolvedValue('https://cdn.interest.app/reels/reel-123/hls/master.m3u8'),
      getPublicUrl: jest.fn().mockImplementation((key) => `https://cdn.interest.app/${key}`),
    };

    mockScanner = {
      scanReel: jest.fn().mockResolvedValue({
        action: 'APPROVE',
        reasons: [],
        scores: { nudity: 0.0, violence: 0.0, hate: 0.0, copyright: 0.0 },
        isAiGenerated: false,
        aiLabelType: AiLabelType.NONE,
      }),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-transcode-99' }),
    };

    mockRedisCounters = {
      getReelCounters: jest.fn().mockResolvedValue({ likes: 0, comments: 0, saves: 0, shares: 0 }),
      getCommentLikeCount: jest.fn().mockResolvedValue(0),
    };

    mockMentions = {
      processMentions: jest.fn().mockResolvedValue({ extractedUsernames: [], notifiedUserIds: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReelsService,
        TranscodeProcessor,
        { provide: DatabaseService, useValue: mockDb },
        { provide: StorageService, useValue: mockStorage },
        { provide: ContentScannerService, useValue: mockScanner },
        { provide: RedisCounterService, useValue: mockRedisCounters },
        { provide: MentionsService, useValue: mockMentions },
        {
          provide: AiInterestSuggesterService,
          useValue: { suggestInterests: jest.fn().mockResolvedValue([]) },
        },
        { provide: getQueueToken('video-transcode'), useValue: mockQueue },
      ],
    }).compile();

    reelsService = module.get<ReelsService>(ReelsService);
    transcodeProcessor = module.get<TranscodeProcessor>(TranscodeProcessor);
  });

  describe('Multipart Upload Initiation & Part Generation', () => {
    it('User A initiates multipart upload: calculates expected parts and stores pending upload', async () => {
      const res = await reelsService.initiateMultipartUpload(userA_Creator, {
        filename: 'distributed_consensus_guide.mp4',
        contentType: 'video/mp4',
        fileSizeBytes: 26 * 1024 * 1024, // 26 MB => 6 parts (5MB each)
      });

      expect(res.uploadId).toBe('s3-upload-id-999');
      expect(res.expectedParts).toBe(6);
      expect(res.s3Key).toContain('distributed_consensus_guide.mp4');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO reels'),
        expect.arrayContaining([userA_Creator, 'distributed_consensus_guide.mp4', ReelStatus.PENDING_UPLOAD]),
      );
    });

    it('User A requests presigned part URLs: verifies ownership and marks status as UPLOADING', async () => {
      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'reel-test-1', creator_id: userA_Creator, status: ReelStatus.PENDING_UPLOAD }],
      });

      const urls = await reelsService.getMultipartPartUrls(userA_Creator, {
        reelId: 'reel-test-1',
        uploadId: 's3-upload-id-999',
        s3Key: 'uploads/raw/reel-test-1_vid.mp4',
        partNumbers: [1, 2, 3],
      });

      expect(urls.length).toBe(3);
      expect(urls[0].url).toContain('parts/1?uploadId=s3-upload-id-999');
      expect(urls[2].url).toContain('parts/3?uploadId=s3-upload-id-999');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reels SET status = $1'),
        [ReelStatus.UPLOADING, 'reel-test-1'],
      );
    });

    it('User B (Non-owner) cannot request part URLs for User A reel (403 Forbidden)', async () => {
      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'reel-test-1', creator_id: userA_Creator, status: ReelStatus.PENDING_UPLOAD }],
      });

      await expect(
        reelsService.getMultipartPartUrls(userB_AuthorizedViewer, {
          reelId: 'reel-test-1',
          uploadId: 's3-upload-id-999',
          s3Key: 'uploads/raw/reel-test-1_vid.mp4',
          partNumbers: [1],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Multipart Completion, Validation & Abort', () => {
    it('User A completes multipart upload: validates non-empty parts and ETags', async () => {
      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'reel-test-1', creator_id: userA_Creator, status: ReelStatus.UPLOADING }],
      });

      const res = await reelsService.completeMultipartUpload(userA_Creator, {
        reelId: 'reel-test-1',
        uploadId: 's3-upload-id-999',
        s3Key: 'uploads/raw/reel-test-1_vid.mp4',
        parts: [
          { partNumber: 1, etag: '"etag-chunk-1"' },
          { partNumber: 2, etag: '"etag-chunk-2"' },
        ],
      });

      expect(res.success).toBe(true);
      expect(mockStorage.completeMultipartUpload).toHaveBeenCalledWith(
        'uploads/raw/reel-test-1_vid.mp4',
        's3-upload-id-999',
        [
          { PartNumber: 1, ETag: '"etag-chunk-1"' },
          { PartNumber: 2, ETag: '"etag-chunk-2"' },
        ],
      );
    });

    it('Rejects completion with empty parts array or empty ETag', async () => {
      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'reel-test-1', creator_id: userA_Creator, status: ReelStatus.UPLOADING }],
      });

      await expect(
        reelsService.completeMultipartUpload(userA_Creator, {
          reelId: 'reel-test-1',
          uploadId: 's3-upload-id-999',
          s3Key: 'uploads/raw/reel-test-1_vid.mp4',
          parts: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('Duplicate completion is idempotent if reel is already processing or published', async () => {
      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'reel-test-1', creator_id: userA_Creator, status: ReelStatus.PROCESSING }],
      });

      const res = await reelsService.completeMultipartUpload(userA_Creator, {
        reelId: 'reel-test-1',
        uploadId: 's3-upload-id-999',
        s3Key: 'uploads/raw/reel-test-1_vid.mp4',
        parts: [{ partNumber: 1, etag: '"etag-chunk-1"' }],
      });

      expect(res.success).toBe(true);
      expect(res.idempotent).toBe(true);
      // Ensure S3 assemble was NOT triggered again
      expect(mockStorage.completeMultipartUpload).not.toHaveBeenCalled();
    });

    it('User A aborts multipart upload: cancels S3 session and marks reel as FAILED', async () => {
      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'reel-test-1', creator_id: userA_Creator, status: ReelStatus.UPLOADING }],
      });

      const res = await reelsService.abortMultipartUpload(userA_Creator, {
        reelId: 'reel-test-1',
        uploadId: 's3-upload-id-999',
        s3Key: 'uploads/raw/reel-test-1_vid.mp4',
      });

      expect(res.aborted).toBe(true);
      expect(mockStorage.abortMultipartUpload).toHaveBeenCalledWith(
        'uploads/raw/reel-test-1_vid.mp4',
        's3-upload-id-999',
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reels SET status = $1, error_reason = $2'),
        [ReelStatus.FAILED, 'Upload aborted by client', 'reel-test-1'],
      );
    });
  });

  describe('Reel Finalization & Metadata Sanitization', () => {
    it('User A finalizes video reel: strips location coordinates from caption and enqueues transcode', async () => {
      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: 'reel-test-1',
            creator_id: userA_Creator,
            status: ReelStatus.UPLOADING,
            raw_s3_key: 'uploads/raw/reel-test-1_vid.mp4',
          },
        ],
      });

      const res = await reelsService.finalizeReel(userA_Creator, {
        reelId: 'reel-test-1',
        title: 'Paxos vs Raft Comparison',
        caption: 'Recorded at 37.7749, -122.4194 in San Francisco near me #backend @alice',
        primaryInterestId,
        interestTagIds: [primaryInterestId, secondaryInterestId],
        visibility: ReelVisibility.PUBLIC,
      });

      expect(res.status).toBe(ReelStatus.PROCESSING);

      // Verify caption was sanitized of coordinates & geo entities in database transaction
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reels'),
        expect.arrayContaining(['Recorded at in #backend alice']),
      );

      // Verify BullMQ job dispatch
      expect(mockQueue.add).toHaveBeenCalledWith(
        'transcode',
        expect.objectContaining({
          reelId: 'reel-test-1',
          s3RawKey: 'uploads/raw/reel-test-1_vid.mp4',
          primaryInterestId,
        }),
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('Background Transcoding Worker & Safety Gate', () => {
    it('TranscodeProcessor converts video to multi-bitrate HLS, scans for safety, and publishes reel', async () => {
      mockDb.query
        // 1. Initial status update to PROCESSING
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        // 2. Fetch interest vectors
        .mockResolvedValueOnce({
          rowCount: 2,
          rows: [
            { vector: '[' + new Array(512).fill(0.1).join(',') + ']' },
            { vector: '[' + new Array(512).fill(0.2).join(',') + ']' },
          ],
        })
        // 3. Fetch reel metadata for safety scanner
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              title: 'Paxos vs Raft Comparison',
              caption: 'Clean distributed systems guide',
              hashtags: ['backend'],
              transcript_text: 'Distributed consensus algorithms',
              is_ai_generated: false,
            },
          ],
        })
        // 4. Update reel with HLS master URL, thumbnail, duration, status = PUBLISHED
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        // 5. Query creator_id to update profile reels_count
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ creator_id: userA_Creator }] })
        // 6. Update profiles reels_count
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const mockJob = {
        id: 'job-99',
        data: {
          reelId: 'reel-test-1',
          s3RawKey: 'uploads/raw/reel-test-1_vid.mp4',
          primaryInterestId,
          interestTagIds: [primaryInterestId, secondaryInterestId],
          coverTimestampSeconds: 1.5,
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<TranscodeJobPayload>;

      const result = await transcodeProcessor.process(mockJob);

      expect(result.success).toBe(true);
      expect(result.moderationStatus).toBe('APPROVED');
      expect(result.hlsUrl).toContain('master.m3u8');

      // Verify creator profile reels_count was incremented
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE profiles SET reels_count = reels_count + 1'),
        [userA_Creator],
      );
    });

    it('TranscodeProcessor rejects reel when Pre-Publish Safety scan flags severe NSFW content', async () => {
      mockScanner.scanReel.mockResolvedValueOnce({
        action: 'REJECT',
        reasons: ['Severe graphic nudity detected'],
        scores: { nudity: 0.98, violence: 0.0, hate: 0.0, copyright: 0.0 },
        isAiGenerated: false,
        aiLabelType: AiLabelType.NONE,
      });

      mockDb.query
        // 1. Initial status update
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })
        // 2. Fetch interest vectors
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        // 3. Fetch metadata for scanner
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ title: 'Explicit Content', caption: 'NSFW' }],
        })
        // 4. Update reel to status FAILED with rejection reason
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const mockJob = {
        id: 'job-100',
        data: {
          reelId: 'reel-nsfw-1',
          s3RawKey: 'uploads/raw/nsfw.mp4',
          primaryInterestId,
          interestTagIds: [],
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<TranscodeJobPayload>;

      const result = await transcodeProcessor.process(mockJob);

      expect(result.success).toBe(false);
      expect(result.moderationStatus).toBe('REJECTED');
      expect(result.rejectionReason).toContain('Severe graphic nudity detected');

      // Verify reel status was set to FAILED in database
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SET status = $1'),
        expect.arrayContaining([ReelStatus.FAILED]),
      );
    });
  });

  describe('Prompt 9 Gate: Cross-User Video Ingestion & Authorized Playback', () => {
    it('User A publishes video -> User B (Authorized Follower) discovers and plays HLS stream', async () => {
      // Setup: Reel has been published by User A
      const publishedReelRow = {
        id: 'reel-gate-1',
        creator_id: userA_Creator,
        title: 'Advanced Vector Search in Production',
        caption: 'HLS adaptive streaming with pgvector',
        hls_master_url: 'https://cdn.interest.app/reels/reel-gate-1/hls/master.m3u8',
        thumbnail_url: 'https://cdn.interest.app/reels/reel-gate-1/hls/thumb.jpg',
        duration_seconds: 45.0,
        view_count: 100,
        like_count: 25,
        comment_count: 5,
        save_count: 10,
        share_count: 3,
        status: ReelStatus.PUBLISHED,
        visibility: ReelVisibility.PUBLIC,
        is_pinned: false,
        media_type: 'VIDEO',
        image_urls: [],
        hashtags: ['vector', 'pgvector'],
        username: 'creator_alice',
        display_name: 'Alice Developer',
        avatar_url: 'https://cdn.interest.app/avatars/alice.jpg',
        interests: [{ id: primaryInterestId, slug: 'vector-search', title: 'Vector Search', is_primary: true }],
        created_at: new Date(),
      };

      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [publishedReelRow],
      });

      // User B fetches the reel for playback
      const reelForUserB = await reelsService.getReelById('reel-gate-1', userB_AuthorizedViewer);

      expect(reelForUserB.id).toBe('reel-gate-1');
      expect(reelForUserB.creator.username).toBe('creator_alice');
      expect(reelForUserB.hlsMasterUrl).toBe('https://cdn.interest.app/reels/reel-gate-1/hls/master.m3u8');
      expect(reelForUserB.thumbnailUrl).toBe('https://cdn.interest.app/reels/reel-gate-1/hls/thumb.jpg');
      expect(reelForUserB.durationSeconds).toBe(45.0);
    });

    it('User C (Blocked) is blocked from retrieving User A creator reels for playback', async () => {
      // Mock block record between User C and User A
      mockDb.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ 1: 1 }], // Block relationship exists
      });

      await expect(
        reelsService.getCreatorReels(userA_Creator, userC_UnauthorizedViewer),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
