import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LiveService } from './live.service';
import { DatabaseService } from '../../database/database.service';
import { ContentScannerService } from '../safety/content-scanner.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@shared/types';

describe('LiveService (Prompt 27 — Live Video and Events)', () => {
  let service: LiveService;
  let mockContentScanner: any;
  let mockNotificationsService: any;
  let mockDatabaseService: any;

  beforeEach(async () => {
    mockDatabaseService = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    mockContentScanner = {
      scanReel: jest.fn().mockImplementation(async (metadata: any) => {
        const text = (metadata.title + ' ' + (metadata.caption || '')).toLowerCase();
        if (text.includes('illegal') || text.includes('terror') || text.includes('violence')) {
          return {
            action: 'REJECT',
            reasons: ['CRITICAL_SAFETY_VIOLATION'],
            scores: { nudity: 0, violence: 0.95, hateSpeech: 0, copyrightMatch: 0, syntheticProbability: 0 },
            isAiGenerated: false,
          };
        }
        return {
          action: 'APPROVE',
          reasons: [],
          scores: { nudity: 0, violence: 0, hateSpeech: 0, copyrightMatch: 0, syntheticProbability: 0 },
          isAiGenerated: false,
        };
      }),
    };

    mockNotificationsService = {
      dispatchNotification: jest.fn().mockResolvedValue({ delivered: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiveService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ContentScannerService, useValue: mockContentScanner },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<LiveService>(LiveService);
  });

  it('should be defined with seeded pilot events', async () => {
    expect(service).toBeDefined();
    const events = await service.listEvents();
    expect(events.length).toBeGreaterThanOrEqual(2);
    const liveNow = events.find((e) => e.status === 'LIVE');
    expect(liveNow).toBeDefined();
    expect(liveNow?.id).toBe('live-event-scale-systems-01');
  });

  describe('1. Pilot Scheduled Events & Stream Key Security', () => {
    it('creates an event with HMAC-SHA256 hashed stream key and returns raw key once', async () => {
      const result = await service.createEvent('user_host_1', 'lead_dev', {
        title: 'Microservices & Event Mesh Masterclass',
        description: 'Deep dive into event-driven patterns with Kafka and NATS.',
        coverImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
        interestId: 'interest_backend',
        interestName: 'Backend Engineering',
        scheduledStartTime: new Date(Date.now() + 3600000).toISOString(),
        is18Plus: false,
        recordSession: true,
        recordingRetentionDays: 30,
      });

      expect(result.event).toBeDefined();
      expect(result.event.status).toBe('SCHEDULED');
      expect(result.event.streamKeyHash).toBeDefined();
      expect(result.streamKey).toMatch(/^interest_sk_[a-f0-9]{48}$/);
      expect(result.event.streamKeyHash).not.toEqual(result.streamKey);
    });

    it('rejects event scheduling if content safety filter flags the title or description', async () => {
      await expect(
        service.createEvent('user_host_1', 'bad_actor', {
          title: 'Illegal hacking and violence stream',
          description: 'Bypassing security protocols',
          interestId: 'interest_security',
          interestName: 'Cybersecurity',
          scheduledStartTime: new Date(Date.now() + 3600000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Reminders & RSVP Flow', () => {
    it('toggles reminders on and off, incrementing counter and dispatching notification', async () => {
      const eventId = 'live-event-sound-masterclass-02';
      const initial = await service.getEventById(eventId);
      const initialCount = initial.remindersCount;

      // Toggle ON
      const toggleOn = await service.toggleEventReminder('user_listener_99', eventId);
      expect(toggleOn.isReminderSet).toBe(true);
      expect(toggleOn.remindersCount).toBe(initialCount + 1);
      expect(mockNotificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_listener_99',
          type: NotificationType.INTEREST_DIGEST,
        }),
      );

      // Verify getEventById reflects state for user
      const afterOn = await service.getEventById(eventId, 'user_listener_99');
      expect(afterOn.isReminderSet).toBe(true);

      // Toggle OFF
      const toggleOff = await service.toggleEventReminder('user_listener_99', eventId);
      expect(toggleOff.isReminderSet).toBe(false);
      expect(toggleOff.remindersCount).toBe(initialCount);
    });
  });

  describe('3. Consent-Based Co-Hosting Flow', () => {
    const eventId = 'live-event-scale-systems-01';

    it('executes full mutual-consent co-hosting lifecycle: invite -> accept -> terminate', async () => {
      // 1. Host invites guest
      const invited = await service.inviteCoHost('user_alex_dev', eventId, {
        guestUserId: 'user_guest_sarah',
        guestUsername: 'sarah_cloud',
      });
      expect(invited.coHost).toBeDefined();
      expect(invited.coHost?.userId).toBe('user_guest_sarah');
      expect(invited.coHost?.status).toBe('INVITED');

      // 2. Guest accepts invitation
      const accepted = await service.respondCoHostInvite('user_guest_sarah', eventId, true);
      expect(accepted.coHost?.status).toBe('ACCEPTED');
      expect(accepted.coHost?.joinedAt).toBeDefined();

      // 3. Either party terminates split screen
      const disconnected = await service.terminateCoHost('user_guest_sarah', eventId);
      expect(disconnected.coHost?.status).toBe('DISCONNECTED');
    });

    it('handles declining co-host invitation into DECLINED state', async () => {
      await service.inviteCoHost('user_alex_dev', eventId, {
        guestUserId: 'user_guest_bob',
        guestUsername: 'bob_dev',
      });

      const declined = await service.respondCoHostInvite('user_guest_bob', eventId, false);
      expect(declined.coHost?.status).toBe('DECLINED');
      expect(declined.coHost?.joinedAt).toBeUndefined();
    });

    it('prevents non-hosts from inviting co-hosts', async () => {
      await expect(
        service.inviteCoHost('random_impostor', eventId, {
          guestUserId: 'user_guest_sarah',
          guestUsername: 'sarah_cloud',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents third-parties from terminating co-host', async () => {
      await service.inviteCoHost('user_alex_dev', eventId, {
        guestUserId: 'user_guest_sarah',
        guestUsername: 'sarah_cloud',
      });
      await service.respondCoHostInvite('user_guest_sarah', eventId, true);

      await expect(
        service.terminateCoHost('random_user_intruder', eventId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Moderated Q&A Flow', () => {
    const eventId = 'live-event-scale-systems-01';

    it('submits a question in unapproved state and scans content', async () => {
      const q = await service.submitQuestion('user_viewer_3', 'viewer_alice', eventId, {
        question: 'What is the optimal connection pool size for CockroachDB?',
      });

      expect(q).toBeDefined();
      expect(q.isApproved).toBe(false);
      expect(q.upvotesCount).toBe(1);
    });

    it('rejects questions containing flagged unsafe text', async () => {
      await expect(
        service.submitQuestion('user_viewer_3', 'viewer_bad', eventId, {
          question: 'How do I generate illegal violence script?',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows host to approve and pin question', async () => {
      const questions = await service.listQuestions(eventId);
      const target = questions[0];

      const moderated = await service.moderateQuestion('user_alex_dev', eventId, target.id, {
        isApproved: true,
        isPinned: true,
      });

      expect(moderated.isApproved).toBe(true);
      expect(moderated.isPinned).toBe(true);
    });

    it('allows viewers to upvote and retract upvotes on questions', async () => {
      const questions = await service.listQuestions(eventId);
      const target = questions[0];
      const initialCount = target.upvotesCount;

      const up1 = await service.upvoteQuestion('new_user_upvote', eventId, target.id);
      expect(up1.hasUpvoted).toBe(true);
      expect(up1.upvotesCount).toBe(initialCount + 1);

      const up2 = await service.upvoteQuestion('new_user_upvote', eventId, target.id);
      expect(up2.hasUpvoted).toBe(false);
      expect(up2.upvotesCount).toBe(initialCount);
    });
  });

  describe('5. Throttled Reactions Rate Limiting', () => {
    const eventId = 'live-event-scale-systems-01';

    it('permits up to 8 reactions per second and throttles 9th reaction', () => {
      const userId = 'spammer_user_44';
      for (let i = 0; i < 8; i++) {
        const res = service.emitReaction(userId, eventId, 'HEART');
        expect(res.success).toBe(true);
        expect(res.throttled).toBe(false);
      }

      // 9th within same second must throttle
      const throttledRes = service.emitReaction(userId, eventId, 'FIRE');
      expect(throttledRes.success).toBe(false);
      expect(throttledRes.throttled).toBe(true);
    });
  });

  describe('6. Stream Health Telemetry & Degraded State Evaluation', () => {
    const eventId = 'live-event-scale-systems-01';

    it('updates health telemetry and detects DEGRADED status when dropped frames exceed threshold', async () => {
      const updated = await service.updateStreamHealth('user_alex_dev', eventId, {
        status: 'HEALTHY',
        bitrateKbps: 700, // < 800 => triggers DEGRADED
        fps: 28,
        droppedFramePercent: 24, // > 20 => triggers DEGRADED
        jitterMs: 45,
      });

      expect(updated.health.status).toBe('DEGRADED');
      expect(updated.health.bitrateKbps).toBe(700);
      expect(updated.health.droppedFramePercent).toBe(24);
    });
  });

  describe('7. Age Verification & Emergency Kill Switch', () => {
    const adultEventId = 'live-event-sound-masterclass-02';

    it('blocks viewers under 18 from 18+ restricted streams', async () => {
      const event = await service.getEventById(adultEventId);
      expect(event.is18Plus).toBe(true);

      expect(() => service.verifyAgeAccess('minor_user', event, 16)).toThrow(ForbiddenException);
      expect(service.verifyAgeAccess('adult_user', event, 24)).toBe(true);
    });

    it('escalates critical safety reports directly to TERMINATED_MODERATION', async () => {
      const liveNowId = 'live-event-scale-systems-01';
      const result = await service.reportLiveStream('watcher_99', liveNowId, {
        category: 'CRITICAL_SAFETY',
        reason: 'Severe immediate threat or policy violation broadcasted',
      });

      expect(result.escalated).toBe(true);
      const event = await service.getEventById(liveNowId);
      expect(event.status).toBe('TERMINATED_MODERATION');
      expect(event.actualEndTime).toBeDefined();
    });
  });

  describe('8. Permitted Recordings & 30-Day Retention Policy', () => {
    it('sets 30-day retention and archives VOD when host ends stream with recording opt-in', async () => {
      const newLive = await service.createEvent('user_producer', 'podcaster_dan', {
        title: 'Weekly Tech Insights Live',
        description: 'Recording permitted session',
        interestId: 'interest_tech',
        interestName: 'Technology',
        scheduledStartTime: new Date().toISOString(),
        recordSession: true,
        recordingRetentionDays: 30,
      });

      const ended = await service.endLiveStream('user_producer', newLive.event.id);
      expect(ended.status).toBe('ENDED');
      expect(ended.recordingUrl).toContain(`/recordings/${newLive.event.id}/vod_archive.mp4`);
      expect(ended.recordingRetentionDays).toBe(30);
    });
  });
});
