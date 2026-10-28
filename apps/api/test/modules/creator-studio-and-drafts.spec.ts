import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreatorDraftsService } from '../../src/modules/creator/creator-drafts.service';
import { CreatorSchedulingService } from '../../src/modules/creator/creator-scheduling.service';
import { CreatorStudioService } from '../../src/modules/creator/creator-studio.service';
import { DatabaseService } from '../../src/database/database.service';
import { ReelStatus } from '@shared/types';

describe('Prompt 14 — Creator Studio & Drafts Gate', () => {
  let draftsService: CreatorDraftsService;
  let schedulingService: CreatorSchedulingService;
  let studioService: CreatorStudioService;

  const mockDb = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    mockDb.query.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorDraftsService,
        CreatorSchedulingService,
        CreatorStudioService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    draftsService = module.get<CreatorDraftsService>(CreatorDraftsService);
    schedulingService = module.get<CreatorSchedulingService>(CreatorSchedulingService);
    studioService = module.get<CreatorStudioService>(CreatorStudioService);
  });

  describe('1. Draft Preparation & Resilient Auto-Saving (Zero Work Loss)', () => {
    it('saves a full creator studio draft with editing recipe, subtitles, and audio mix', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // no client_draft_id match
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'draft-uuid-1',
              user_id: 'creator-user-1',
              client_draft_id: 'client-draft-abc',
              title: 'Tokyo Street Food',
              caption: 'Best ramen in Shibuya! #foodie #tokyo',
              aspect_ratio: '9:16',
              trim_start_ms: 1000,
              trim_end_ms: 14000,
              cover_frame_timestamp_ms: 3500,
              crop_rect: JSON.stringify({ x: 0, y: 0, width: 1080, height: 1920 }),
              subtitles: JSON.stringify([
                { id: 'sub-1', startTimeMs: 1200, endTimeMs: 4500, text: 'Look at this delicious broth' },
              ]),
              text_overlays: JSON.stringify([
                { id: 'txt-1', text: 'Shibuya Ramen Tour', color: '#FFD700', fontSize: 28, xPercent: 50, yPercent: 15, startTimeSeconds: 1, endTimeSeconds: 6 },
              ]),
              audio_controls: JSON.stringify({
                originalVolume: 0.7,
                soundVolume: 0.4,
                isMuted: false,
                soundStartOffsetMs: 200,
              }),
              sound_id: '11111111-0000-4000-a000-000000000005',
              visibility: 'PUBLIC',
              allow_comments: true,
              allow_remix: true,
              is_commercial: false,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

      const draft = await draftsService.saveDraft('creator-user-1', {
        clientDraftId: 'client-draft-abc',
        title: 'Tokyo Street Food',
        caption: 'Best ramen in Shibuya! #foodie #tokyo',
        aspectRatio: '9:16',
        trimStartMs: 1000,
        trimEndMs: 14000,
        coverFrameTimestampMs: 3500,
        cropRect: { x: 0, y: 0, width: 1080, height: 1920 },
        subtitles: [{ id: 'sub-1', startTimeMs: 1200, endTimeMs: 4500, text: 'Look at this delicious broth' }],
        textOverlays: [{ id: 'txt-1', text: 'Shibuya Ramen Tour', color: '#FFD700', fontSize: 28, xPercent: 50, yPercent: 15, startTimeSeconds: 1, endTimeSeconds: 6 }],
        audioControls: { originalVolume: 0.7, soundVolume: 0.4, isMuted: false, soundStartOffsetMs: 200 },
        soundId: '11111111-0000-4000-a000-000000000005',
        visibility: 'PUBLIC',
        allowComments: true,
        allowRemix: true,
      });

      expect(draft.id).toBe('draft-uuid-1');
      expect(draft.clientDraftId).toBe('client-draft-abc');
      expect(draft.aspectRatio).toBe('9:16');
      expect(draft.trimStartMs).toBe(1000);
      expect(draft.trimEndMs).toBe(14000);
      expect(draft.subtitles?.length).toBe(1);
      expect(draft.subtitles![0].text).toBe('Look at this delicious broth');
      expect(draft.textOverlays?.length).toBe(1);
      expect(draft.audioControls?.soundVolume).toBe(0.4);
    });

    it('idempotently updates existing draft when clientDraftId matches (prevents work loss during app backgrounding)', async () => {
      // 1. clientDraftId check finds existing draft
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'draft-uuid-1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'draft-uuid-1' }] }) // verify ownership
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'draft-uuid-1',
              user_id: 'creator-user-1',
              client_draft_id: 'client-draft-abc',
              title: 'Tokyo Street Food (Auto-Saved)',
              caption: 'Updated caption after interruption',
              aspect_ratio: '9:16',
              trim_start_ms: 1000,
              cover_frame_timestamp_ms: 3500,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        });

      const updated = await draftsService.saveDraft('creator-user-1', {
        clientDraftId: 'client-draft-abc',
        title: 'Tokyo Street Food (Auto-Saved)',
        caption: 'Updated caption after interruption',
      });

      expect(updated.id).toBe('draft-uuid-1');
      expect(updated.title).toBe('Tokyo Street Food (Auto-Saved)');
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('lists and deletes drafts correctly', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'draft-1',
              user_id: 'creator-user-1',
              title: 'Draft 1',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'draft-1' }],
        });

      const drafts = await draftsService.getDrafts('creator-user-1');
      expect(drafts.length).toBe(1);

      const del = await draftsService.deleteDraft('creator-user-1', 'draft-1');
      expect(del.deleted).toBe(true);
      expect(del.draftId).toBe('draft-1');
    });
  });

  describe('2. Licensed Sound Library & Audio Authorization', () => {
    it('retrieves only approved licensed sounds and filters by search query', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'sound-synth-1',
              title: 'Cyber Pulse Synthwave',
              artist: 'NeonGrid',
              duration_seconds: '45.0',
              audio_url: 'https://cdn.interest.app/audio/synth.mp3',
              genre: 'Electronic',
              is_licensed: true,
              license_type: 'COMMERCIAL_APPROVED',
              reels_count: '890',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ total: 1 }] });

      const res = await studioService.getLicensedSounds('synth', 10, 0);

      expect(res.sounds.length).toBe(1);
      expect(res.sounds[0].title).toBe('Cyber Pulse Synthwave');
      expect(res.sounds[0].isLicensed).toBe(true);
      expect(res.sounds[0].licenseType).toBe('COMMERCIAL_APPROVED');
    });

    it('rejects publication when an unlicensed audio track is attached', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // no existing publishing session
        .mockResolvedValueOnce({
          rows: [{ id: 'unlicensed-audio-id', is_licensed: false }],
        });

      await expect(
        studioService.publishOrSchedule('creator-user-1', {
          clientPublicationId: 'pub-token-unlicensed',
          title: 'Unlicensed Track Reel',
          soundId: 'unlicensed-audio-id',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Duplicate Publication Prevention & Idempotency', () => {
    it('prevents double-publication when clientPublicationId was already submitted', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'session-existing',
            reel_id: 'reel-existing',
            client_publication_id: 'client-pub-unique-key',
            status: 'PUBLISHED',
            stage: 'READY',
            progress_percent: '100.0',
            updated_at: new Date(),
          },
        ],
      });

      const res = await studioService.publishOrSchedule('creator-user-1', {
        clientPublicationId: 'client-pub-unique-key',
        title: 'Re-Submitted Reel',
      });

      expect(res.sessionId).toBe('session-existing');
      expect(res.status).toBe('PUBLISHED');
      // No insert into reels or audio check performed
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Timezone-Safe Scheduling & Automated Publishing', () => {
    it('schedules a reel with a future ISO timestamp and stores UTC time', async () => {
      const scheduledUtc = new Date(Date.now() + 7200000).toISOString(); // 2 hours ahead

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // no existing session
        .mockResolvedValueOnce({ rows: [{ id: 'reel-scheduled-1' }] }) // insert reel
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'session-sched-1',
              reel_id: 'reel-scheduled-1',
              client_publication_id: 'pub-sched-token-1',
              status: 'SCHEDULED',
              stage: 'SCHEDULED_READY',
              progress_percent: '100.0',
              scheduled_at: new Date(scheduledUtc),
              updated_at: new Date(),
            },
          ],
        }); // insert publishing session

      const res = await studioService.publishOrSchedule('creator-user-1', {
        clientPublicationId: 'pub-sched-token-1',
        title: 'Scheduled Tech Vlog',
        scheduledAt: scheduledUtc,
        clientTimezoneOffsetMinutes: 330,
        visibility: 'PUBLIC',
      });

      expect(res.status).toBe('SCHEDULED');
      expect(res.stage).toBe('SCHEDULED_READY');
      expect(res.scheduledAt).toBeDefined();
    });

    it('rejects scheduled times in the past', async () => {
      const pastUtc = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        studioService.publishOrSchedule('creator-user-1', {
          clientPublicationId: 'pub-sched-past',
          title: 'Past Schedule Test',
          scheduledAt: pastUtc,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('publishDueScheduledReels automatically transitions due reels to PUBLISHED', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            { id: 'reel-due-1', creator_id: 'creator-1', title: 'Due Reel 1' },
            { id: 'reel-due-2', creator_id: 'creator-2', title: 'Due Reel 2' },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // update status to PUBLISHED

      const result = await schedulingService.publishDueScheduledReels();

      expect(result.publishedCount).toBe(2);
      expect(result.publishedIds).toEqual(['reel-due-1', 'reel-due-2']);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('5. Publishing Status Recovery (Resuming Interrupted Work)', () => {
    it('recovers publishing session progress and video URLs after app backgrounding or restart', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'session-rec-1',
            reel_id: 'reel-rec-1',
            client_publication_id: 'interrupted-token-444',
            status: 'PROCESSING',
            stage: 'TRANSCODING',
            progress_percent: '80.0',
            hls_master_url: 'https://cdn.interest.app/reels/hls/master.m3u8',
            thumbnail_url: 'https://cdn.interest.app/reels/thumbs/cover.jpg',
            updated_at: new Date(),
          },
        ],
      });

      const session = await studioService.getPublishingStatus('creator-user-1', 'interrupted-token-444');

      expect(session.sessionId).toBe('session-rec-1');
      expect(session.status).toBe('PROCESSING');
      expect(session.stage).toBe('TRANSCODING');
      expect(session.progressPercent).toBe(80.0);
      expect(session.hlsMasterUrl).toBe('https://cdn.interest.app/reels/hls/master.m3u8');
      expect(session.thumbnailUrl).toBe('https://cdn.interest.app/reels/thumbs/cover.jpg');
    });

    it('throws NotFoundException when recovering an unknown publishing session', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        studioService.getPublishingStatus('creator-user-1', 'nonexistent-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('6. Post-Publishing Editing & Safe Deletion', () => {
    it('updates published reel caption, visibility, and audience permissions with ownership check', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'reel-1', creator_id: 'creator-user-1' }] }) // ownership
        .mockResolvedValueOnce({ rows: [] }); // update query

      const res = await studioService.updatePublishedReel('creator-user-1', 'reel-1', {
        title: 'Updated Title',
        caption: 'New caption #updates',
        visibility: 'FOLLOWERS_ONLY',
        allowComments: false,
        allowRemix: true,
      });

      expect(res.updated).toBe(true);
      expect(res.reelId).toBe('reel-1');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('deletes reel safely with creator ownership verification', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'reel-1' }] });

      const res = await studioService.deleteReel('creator-user-1', 'reel-1');

      expect(res.deleted).toBe(true);
      expect(res.reelId).toBe('reel-1');
    });
  });
});
