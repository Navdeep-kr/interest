import { Test, TestingModule } from '@nestjs/testing';
import { CreatorStudioService } from './creator-studio.service';
import { DatabaseService } from '../../database/database.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CreatorStudioService', () => {
  let service: CreatorStudioService;
  let databaseService: DatabaseService;

  const mockDb = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    mockDb.query.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorStudioService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<CreatorStudioService>(CreatorStudioService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  describe('getLicensedSounds', () => {
    it('returns authorized licensed sounds and respects filters', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'sound-1',
              title: 'Tokyo Sunset Chillhop',
              artist: 'AestheticBeats',
              duration_seconds: '55.0',
              audio_url: 'https://cdn.interest.app/audio/chillhop.mp3',
              genre: 'Lo-Fi',
              is_licensed: true,
              license_type: 'CREATIVE_COMMONS',
              reels_count: '3150',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ total: 1 }],
        });

      const res = await service.getLicensedSounds('Tokyo', 10, 0);

      expect(res.sounds.length).toBe(1);
      expect(res.sounds[0].title).toBe('Tokyo Sunset Chillhop');
      expect(res.sounds[0].isLicensed).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('publishOrSchedule — Idempotency & Duplicate Prevention', () => {
    it('returns existing session without creating duplicates if clientPublicationId already exists', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'session-existing-1',
            reel_id: 'reel-existing-1',
            client_publication_id: 'client-token-abc-123',
            status: 'PUBLISHED',
            stage: 'READY',
            progress_percent: '100.0',
            updated_at: new Date(),
          },
        ],
      });

      const res = await service.publishOrSchedule('creator-1', {
        clientPublicationId: 'client-token-abc-123',
        title: 'Duplicate Attempt',
        visibility: 'PUBLIC',
      });

      expect(res.sessionId).toBe('session-existing-1');
      expect(res.status).toBe('PUBLISHED');
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('rejects publication if selected audio track is not licensed', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // no existing session
        .mockResolvedValueOnce({
          rows: [{ id: 'sound-unlicensed', is_licensed: false }],
        });

      await expect(
        service.publishOrSchedule('creator-1', {
          clientPublicationId: 'new-token-456',
          title: 'Unlicensed Audio Test',
          soundId: '00000000-0000-0000-0000-000000000099',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates new reel with full editing recipe and returns publishing session', async () => {
      const scheduledTime = new Date(Date.now() + 3600000).toISOString();

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // 1. no existing session
        .mockResolvedValueOnce({ rows: [{ id: 'sound-licensed', is_licensed: true }] }) // 2. sound check
        .mockResolvedValueOnce({ rows: [{ id: 'reel-new-123' }] }) // 3. insert reel
        .mockResolvedValueOnce({ rows: [] }) // 4. link interest
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'session-new-1',
              reel_id: 'reel-new-123',
              client_publication_id: 'token-recipe-789',
              status: 'SCHEDULED',
              stage: 'SCHEDULED_READY',
              progress_percent: '100.0',
              scheduled_at: new Date(scheduledTime),
              updated_at: new Date(),
            },
          ],
        }); // 5. insert publishing session

      const res = await service.publishOrSchedule('creator-1', {
        clientPublicationId: 'token-recipe-789',
        title: 'Sunset Highlights',
        caption: '#sunset #coding',
        primaryInterestId: '00000000-0000-0000-0000-000000000010',
        aspectRatio: '9:16',
        trimStartMs: 500,
        trimEndMs: 15500,
        coverFrameTimestampMs: 2500,
        subtitles: [{ id: 'sub-1', startTimeMs: 0, endTimeMs: 3000, text: 'Hello World' }],
        textOverlays: [{ id: 'txt-1', text: 'Golden Hour', color: '#FFF', fontSize: 24, xPercent: 50, yPercent: 20, startTimeSeconds: 0, endTimeSeconds: 5 }],
        audioControls: { originalVolume: 0.8, soundVolume: 0.5, isMuted: false },
        soundId: '00000000-0000-0000-0000-000000000001',
        scheduledAt: scheduledTime,
        visibility: 'PUBLIC',
        allowComments: true,
        allowRemix: true,
      });

      expect(res.sessionId).toBe('session-new-1');
      expect(res.reelId).toBe('reel-new-123');
      expect(res.status).toBe('SCHEDULED');
      expect(res.scheduledAt).toBeDefined();
    });

    it('rejects scheduling in the past or less than 1 minute ahead', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();

      mockDb.query.mockResolvedValueOnce({ rows: [] }); // no existing session

      await expect(
        service.publishOrSchedule('creator-1', {
          clientPublicationId: 'token-past',
          title: 'Past Schedule Test',
          scheduledAt: pastTime,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPublishingStatus — Publishing Status Recovery', () => {
    it('retrieves active publishing session by clientPublicationId', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'session-rec-1',
            reel_id: 'reel-rec-1',
            client_publication_id: 'client-rec-token',
            status: 'PROCESSING',
            stage: 'TRANSCODING',
            progress_percent: '75.0',
            hls_master_url: 'https://cdn.interest.app/reels/rec.m3u8',
            updated_at: new Date(),
          },
        ],
      });

      const res = await service.getPublishingStatus('creator-1', 'client-rec-token');

      expect(res.sessionId).toBe('session-rec-1');
      expect(res.status).toBe('PROCESSING');
      expect(res.stage).toBe('TRANSCODING');
      expect(res.progressPercent).toBe(75.0);
      expect(res.hlsMasterUrl).toBe('https://cdn.interest.app/reels/rec.m3u8');
    });

    it('throws NotFoundException if session not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.getPublishingStatus('creator-1', 'unknown-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePublishedReel & deleteReel', () => {
    it('updates reel metadata with ownership check', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-1', creator_id: 'creator-1' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] }); // update

      const res = await service.updatePublishedReel('creator-1', 'reel-1', {
        title: 'Updated Title',
        visibility: 'FOLLOWERS_ONLY',
      });

      expect(res.updated).toBe(true);
      expect(res.reelId).toBe('reel-1');
    });

    it('deletes reel safely', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'reel-1' }] });

      const res = await service.deleteReel('creator-1', 'reel-1');

      expect(res.deleted).toBe(true);
      expect(res.reelId).toBe('reel-1');
    });
  });
});
