import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { ContentScannerService } from '../safety/content-scanner.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  LiveEventItem,
  LiveQuestionItem,
  LiveStreamStatus,
  StreamHealthStatus,
  CoHostStatus,
  LiveReactionType,
  NotificationType,
  NotificationPriority,
} from '@shared/types';
import {
  CreateLiveEventDto,
  UpdateStreamHealthDto,
  InviteCoHostDto,
  RespondCoHostInviteDto,
  SubmitLiveQuestionDto,
  ModerateQuestionDto,
  ReportLiveStreamDto,
} from './dto/live.dto';

@Injectable()
export class LiveService {
  private readonly logger = new Logger(LiveService.name);

  // In-memory persistent stores with seed events
  private readonly events = new Map<string, LiveEventItem>();
  private readonly questions = new Map<string, LiveQuestionItem[]>(); // key: eventId
  private readonly userReminders = new Map<string, Set<string>>(); // key: eventId -> Set of userIds
  private readonly questionUpvotes = new Map<string, Set<string>>(); // key: questionId -> Set of userIds
  private readonly reactionThrottleMap = new Map<string, number[]>(); // key: `${userId}:${eventId}`

  // Cryptographic secret for stream key hashing
  private readonly STREAM_KEY_SECRET = 'interest_live_hmac_secret_key_prod_vault_2026';

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly contentScanner: ContentScannerService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.seedInitialLiveEvents();
  }

  // ==========================================================================
  // 1. INITIAL PILOT SEED EVENTS
  // ==========================================================================

  private seedInitialLiveEvents(): void {
    const liveNowEventId = 'live-event-scale-systems-01';
    const scheduledEventId = 'live-event-sound-masterclass-02';

    // 1.1 Currently LIVE Event
    const liveNow: LiveEventItem = {
      id: liveNowEventId,
      hostId: 'user_alex_dev',
      hostUsername: 'alex_architect',
      hostAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      title: 'Real-Time Distributed Architecture & Live Code Review',
      description: 'Interactive live session breaking down circuit breakers, PostgreSQL read replicas, and backpressure.',
      coverImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
      interestId: 'interest_engineering_02',
      interestName: 'Software Engineering',
      scheduledStartTime: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      actualStartTime: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      status: 'LIVE',
      is18Plus: false,
      recordSession: true,
      recordingRetentionDays: 30,
      streamKeyHash: this.hashStreamKey('seed_stream_key_alex_live_01'),
      playbackUrl: `https://live.interest.app/hls/${liveNowEventId}/master.m3u8`,
      viewerCount: 1420,
      peakViewers: 1580,
      health: {
        status: 'HEALTHY',
        bitrateKbps: 4500,
        fps: 60,
        droppedFramePercent: 0.2,
        jitterMs: 12,
        lastHeartbeatAt: new Date().toISOString(),
      },
      remindersCount: 380,
      createdAt: '2026-10-18T10:00:00Z',
      updatedAt: '2026-10-18T10:00:00Z',
    };
    this.events.set(liveNowEventId, liveNow);

    // Initial Questions for Live Now event
    const q1: LiveQuestionItem = {
      id: 'q_01',
      eventId: liveNowEventId,
      userId: 'user_dev_sam',
      username: 'sam_coder',
      question: 'How do you prevent pool starvation during sudden traffic spikes?',
      isApproved: true,
      isAnswered: false,
      isPinned: true,
      upvotesCount: 42,
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };
    const q2: LiveQuestionItem = {
      id: 'q_02',
      eventId: liveNowEventId,
      userId: 'user_dev_maria',
      username: 'maria_sys',
      question: 'Can circuit breakers automatically reset without manual intervention?',
      isApproved: true,
      isAnswered: true,
      isPinned: false,
      upvotesCount: 28,
      createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    };
    this.questions.set(liveNowEventId, [q1, q2]);
    this.questionUpvotes.set('q_01', new Set(Array.from({ length: 42 }, (_, i) => `seed_user_q1_${i}`)));
    this.questionUpvotes.set('q_02', new Set(Array.from({ length: 28 }, (_, i) => `seed_user_q2_${i}`)));
    this.userReminders.set(liveNowEventId, new Set(Array.from({ length: 380 }, (_, i) => `seed_user_live_${i}`)));

    // 1.2 Scheduled Future Event (with 18+ Age Gating Pilot)
    const scheduled: LiveEventItem = {
      id: scheduledEventId,
      hostId: 'user_elena_sound',
      hostUsername: 'elena_sound',
      hostAvatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      title: 'Analog Modular Synthesizer Sound Design Workshop',
      description: 'Hands-on patching, FM frequency modulation, and live performance improvisation.',
      coverImageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
      interestId: 'interest_audio_04',
      interestName: 'Audio Production',
      scheduledStartTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), // in 2 hours
      status: 'SCHEDULED',
      is18Plus: true, // Pilot age gate restriction
      recordSession: true,
      recordingRetentionDays: 30,
      streamKeyHash: this.hashStreamKey('seed_stream_key_elena_sched_02'),
      playbackUrl: `https://live.interest.app/hls/${scheduledEventId}/master.m3u8`,
      viewerCount: 0,
      peakViewers: 0,
      health: {
        status: 'HEALTHY',
        bitrateKbps: 0,
        fps: 0,
        droppedFramePercent: 0,
        jitterMs: 0,
        lastHeartbeatAt: new Date().toISOString(),
      },
      remindersCount: 89,
      createdAt: '2026-10-18T14:00:00Z',
      updatedAt: '2026-10-18T14:00:00Z',
    };
    this.events.set(scheduledEventId, scheduled);
    this.userReminders.set(scheduledEventId, new Set(Array.from({ length: 89 }, (_, i) => `seed_user_sched_${i}`)));
  }

  private hashStreamKey(streamKey: string): string {
    return crypto.createHmac('sha256', this.STREAM_KEY_SECRET).update(streamKey).digest('hex');
  }

  // ==========================================================================
  // 2. EVENT SCHEDULING & STREAM KEYS
  // ==========================================================================

  async createEvent(
    hostId: string,
    hostUsername: string,
    dto: CreateLiveEventDto,
  ): Promise<{ event: LiveEventItem; streamKey: string }> {
    // 2.1 Content Safety Scan
    const scan = await this.contentScanner.scanReel({
      reelId: 'live_event_schedule',
      title: dto.title,
      caption: dto.description,
    });

    if (scan.action === 'REJECT') {
      throw new BadRequestException(
        `Live event rejected by moderation filter: Detected ${scan.reasons.join(', ')}.`,
      );
    }

    const eventId = `live_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    // Secure 32-byte high entropy stream key
    const rawStreamKey = `interest_sk_${crypto.randomBytes(24).toString('hex')}`;
    const streamKeyHash = this.hashStreamKey(rawStreamKey);

    const event: LiveEventItem = {
      id: eventId,
      hostId,
      hostUsername,
      title: dto.title,
      description: dto.description,
      coverImageUrl: dto.coverImageUrl,
      interestId: dto.interestId,
      interestName: dto.interestName,
      scheduledStartTime: dto.scheduledStartTime,
      status: 'SCHEDULED',
      is18Plus: dto.is18Plus || false,
      recordSession: dto.recordSession ?? true,
      recordingRetentionDays: dto.recordingRetentionDays || 30,
      streamKeyHash,
      playbackUrl: `https://live.interest.app/hls/${eventId}/master.m3u8`,
      viewerCount: 0,
      peakViewers: 0,
      health: {
        status: 'HEALTHY',
        bitrateKbps: 0,
        fps: 0,
        droppedFramePercent: 0,
        jitterMs: 0,
        lastHeartbeatAt: new Date().toISOString(),
      },
      remindersCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.events.set(eventId, event);
    this.questions.set(eventId, []);
    this.userReminders.set(eventId, new Set());

    // Stream key is returned ONLY once during creation
    return { event, streamKey: rawStreamKey };
  }

  async listEvents(query?: { status?: LiveStreamStatus; interestId?: string }): Promise<LiveEventItem[]> {
    let result = Array.from(this.events.values());
    if (query?.status) {
      result = result.filter((e) => e.status === query.status);
    }
    if (query?.interestId) {
      result = result.filter((e) => e.interestId === query.interestId);
    }
    return result;
  }

  async getEventById(eventId: string, userId?: string): Promise<LiveEventItem> {
    const event = this.events.get(eventId);
    if (!event) throw new NotFoundException(`Live event ${eventId} not found.`);

    let isReminderSet = false;
    if (userId) {
      const userSet = this.userReminders.get(eventId);
      isReminderSet = userSet?.has(userId) || false;
    }

    return { ...event, isReminderSet };
  }

  // ==========================================================================
  // 3. REMINDERS & RSVP
  // ==========================================================================

  async toggleEventReminder(userId: string, eventId: string): Promise<{ isReminderSet: boolean; remindersCount: number }> {
    const event = this.events.get(eventId);
    if (!event) throw new NotFoundException(`Live event ${eventId} not found.`);

    let userSet = this.userReminders.get(eventId);
    if (!userSet) {
      userSet = new Set<string>();
      this.userReminders.set(eventId, userSet);
    }

    let isReminderSet: boolean;
    if (userSet.has(userId)) {
      userSet.delete(userId);
      isReminderSet = false;
    } else {
      userSet.add(userId);
      isReminderSet = true;

      // Dispatch confirmation notification
      try {
        await this.notificationsService.dispatchNotification({
          userId,
          type: NotificationType.INTEREST_DIGEST,
          title: `Reminder Set: ${event.title}`,
          body: `We will notify you when @${event.hostUsername} goes live.`,
          priority: NotificationPriority.NORMAL,
          deepLinkUrl: `interest://live/${eventId}`,
        });
      } catch (_) {}
    }

    event.remindersCount = userSet.size;
    event.updatedAt = new Date().toISOString();

    return { isReminderSet, remindersCount: event.remindersCount };
  }

  // ==========================================================================
  // 4. CONSENT-BASED CO-HOSTING
  // ==========================================================================

  async inviteCoHost(hostId: string, eventId: string, dto: InviteCoHostDto): Promise<LiveEventItem> {
    const event = this.events.get(eventId);
    if (!event) throw new NotFoundException(`Live event ${eventId} not found.`);
    if (event.hostId !== hostId) throw new ForbiddenException('Only the event host can invite co-hosts.');

    event.coHost = {
      userId: dto.guestUserId,
      username: dto.guestUsername,
      status: 'INVITED',
    };
    event.updatedAt = new Date().toISOString();

    return event;
  }

  async respondCoHostInvite(guestUserId: string, eventId: string, accept: boolean): Promise<LiveEventItem> {
    const event = this.events.get(eventId);
    if (!event) throw new NotFoundException(`Live event ${eventId} not found.`);
    if (!event.coHost || event.coHost.userId !== guestUserId) {
      throw new ForbiddenException('No pending co-host invitation for this user.');
    }

    event.coHost.status = accept ? 'ACCEPTED' : 'DECLINED';
    if (accept) {
      event.coHost.joinedAt = new Date().toISOString();
    }
    event.updatedAt = new Date().toISOString();

    return event;
  }

  async terminateCoHost(requesterId: string, eventId: string): Promise<LiveEventItem> {
    const event = this.events.get(eventId);
    if (!event) throw new NotFoundException(`Live event ${eventId} not found.`);
    if (!event.coHost) throw new BadRequestException('No active co-host on this event.');

    if (requesterId !== event.hostId && requesterId !== event.coHost.userId) {
      throw new ForbiddenException('Only the host or co-host can terminate split-screen.');
    }

    event.coHost.status = 'DISCONNECTED';
    event.updatedAt = new Date().toISOString();

    return event;
  }

  // ==========================================================================
  // 5. MODERATED Q&A & QUESTIONS
  // ==========================================================================

  async listQuestions(eventId: string, userId?: string): Promise<LiveQuestionItem[]> {
    const qList = this.questions.get(eventId) || [];
    return qList.map((q) => {
      const upvoters = this.questionUpvotes.get(q.id);
      return {
        ...q,
        hasUpvoted: userId && upvoters ? upvoters.has(userId) : false,
      };
    });
  }

  async submitQuestion(
    userId: string,
    username: string,
    eventId: string,
    dto: SubmitLiveQuestionDto,
  ): Promise<LiveQuestionItem> {
    const event = this.events.get(eventId);
    if (!event) throw new NotFoundException(`Live event ${eventId} not found.`);

    // Content moderation scan on question
    const scan = await this.contentScanner.scanReel({
      reelId: 'live_question',
      title: dto.question,
    });

    if (scan.action === 'REJECT') {
      throw new BadRequestException('Question was flagged by live moderation filter.');
    }

    const questionId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const questionItem: LiveQuestionItem = {
      id: questionId,
      eventId,
      userId,
      username,
      question: dto.question,
      isApproved: false, // Default requires host/moderator approval
      isAnswered: false,
      isPinned: false,
      upvotesCount: 1,
      createdAt: new Date().toISOString(),
    };

    let list = this.questions.get(eventId);
    if (!list) {
      list = [];
      this.questions.set(eventId, list);
    }
    list.push(questionItem);

    const upvoters = new Set<string>([userId]);
    this.questionUpvotes.set(questionId, upvoters);

    return questionItem;
  }

  async moderateQuestion(
    moderatorId: string,
    eventId: string,
    questionId: string,
    dto: ModerateQuestionDto,
  ): Promise<LiveQuestionItem> {
    const event = this.events.get(eventId);
    if (!event) throw new NotFoundException(`Live event ${eventId} not found.`);
    if (event.hostId !== moderatorId) throw new ForbiddenException('Only host/moderator can curate Q&A.');

    const list = this.questions.get(eventId) || [];
    const question = list.find((q) => q.id === questionId);
    if (!question) throw new NotFoundException(`Question ${questionId} not found.`);

    if (dto.isApproved !== undefined) question.isApproved = dto.isApproved;
    if (dto.isAnswered !== undefined) question.isAnswered = dto.isAnswered;
    if (dto.isPinned !== undefined) {
      // Unpin any previously pinned question
      if (dto.isPinned) {
        list.forEach((q) => (q.isPinned = false));
      }
      question.isPinned = dto.isPinned;
    }

    return question;
  }

  async upvoteQuestion(userId: string, eventId: string, questionId: string): Promise<{ upvotesCount: number; hasUpvoted: boolean }> {
    const list = this.questions.get(eventId) || [];
    const question = list.find((q) => q.id === questionId);
    if (!question) throw new NotFoundException(`Question ${questionId} not found.`);

    let upvoters = this.questionUpvotes.get(questionId);
    if (!upvoters) {
      upvoters = new Set<string>();
      this.questionUpvotes.set(questionId, upvoters);
    }

    let hasUpvoted: boolean;
    if (upvoters.has(userId)) {
      upvoters.delete(userId);
      hasUpvoted = false;
    } else {
      upvoters.add(userId);
      hasUpvoted = true;
    }

    question.upvotesCount = upvoters.size;
    return { upvotesCount: question.upvotesCount, hasUpvoted };
  }

  // ==========================================================================
  // 6. REAL-TIME REACTIONS WITH RATE LIMIT THROTTLING
  // ==========================================================================

  emitReaction(userId: string, eventId: string, reaction: LiveReactionType): { success: boolean; throttled: boolean } {
    const key = `${userId}:${eventId}`;
    const now = Date.now();
    let timestamps = this.reactionThrottleMap.get(key) || [];

    // Sliding 1-second window: max 8 reactions / sec
    timestamps = timestamps.filter((t) => now - t < 1000);
    if (timestamps.length >= 8) {
      return { success: false, throttled: true };
    }

    // Periodic auto-prune stale throttle entries to keep memory strictly bounded
    if (this.reactionThrottleMap.size > 200) {
      for (const [k, ts] of this.reactionThrottleMap.entries()) {
        if (ts.length === 0 || now - ts[ts.length - 1] > 5000) {
          this.reactionThrottleMap.delete(k);
        }
      }
    }

    timestamps.push(now);
    this.reactionThrottleMap.set(key, timestamps);

    return { success: true, throttled: false };
  }

  // ==========================================================================
  // 7. STREAM HEALTH TELEMETRY & RECONNECTION
  // ==========================================================================

  async updateStreamHealth(hostId: string, eventId: string, dto: UpdateStreamHealthDto): Promise<LiveEventItem> {
    const event = this.events.get(eventId);
    if (!event) throw new NotFoundException(`Live event ${eventId} not found.`);
    if (event.hostId !== hostId) throw new ForbiddenException('Only the host can report stream health telemetry.');

    let computedStatus: StreamHealthStatus = dto.status;
    if (dto.droppedFramePercent > 20 || dto.bitrateKbps < 800) {
      computedStatus = 'DEGRADED';
    }
    if (dto.droppedFramePercent > 50 || dto.bitrateKbps < 300) {
      computedStatus = 'CRITICAL';
    }

    event.health = {
      status: computedStatus,
      bitrateKbps: dto.bitrateKbps,
      fps: dto.fps,
      droppedFramePercent: dto.droppedFramePercent,
      jitterMs: dto.jitterMs,
      lastHeartbeatAt: new Date().toISOString(),
    };
    event.updatedAt = new Date().toISOString();

    return event;
  }

  // ==========================================================================
  // 8. AGE GATING & EMERGENCY KILL SWITCH
  // ==========================================================================

  verifyAgeAccess(userId: string, event: LiveEventItem, userAge: number): boolean {
    if (!event.is18Plus) return true;
    if (userAge < 18) {
      throw new ForbiddenException('This live broadcast is restricted to viewers 18 years of age or older.');
    }
    return true;
  }

  async reportLiveStream(reporterId: string, eventId: string, dto: ReportLiveStreamDto): Promise<{ success: boolean; escalated: boolean }> {
    const event = this.events.get(eventId);
    if (!event) throw new NotFoundException(`Live event ${eventId} not found.`);

    this.logger.warn(`Live stream report on ${eventId} by ${reporterId}: Category=${dto.category}, Reason=${dto.reason}`);

    // If critical violation, trigger emergency kill switch
    if (dto.category === 'CRITICAL_SAFETY' || dto.category === 'VIOLENCE') {
      return this.terminateStreamForModeration(eventId, dto.reason);
    }

    return { success: true, escalated: false };
  }

  async terminateStreamForModeration(eventId: string, reason: string): Promise<{ success: boolean; escalated: boolean }> {
    const event = this.events.get(eventId);
    if (!event) throw new NotFoundException(`Live event ${eventId} not found.`);

    event.status = 'TERMINATED_MODERATION';
    event.actualEndTime = new Date().toISOString();
    event.updatedAt = new Date().toISOString();

    this.logger.error(`[EMERGENCY KILL SWITCH] Terminated live stream ${eventId}: ${reason}`);
    return { success: true, escalated: true };
  }

  // ==========================================================================
  // 9. PERMITTED RECORDINGS & SESSION COMPLETION
  // ==========================================================================

  async endLiveStream(hostId: string, eventId: string): Promise<LiveEventItem> {
    const event = this.events.get(eventId);
    if (!event) throw new NotFoundException(`Live event ${eventId} not found.`);
    if (event.hostId !== hostId) throw new ForbiddenException('Only the host can end this live stream.');

    event.status = 'ENDED';
    event.actualEndTime = new Date().toISOString();
    event.updatedAt = new Date().toISOString();

    // Permitted recording handling
    if (event.recordSession) {
      event.recordingUrl = `https://vod.interest.app/recordings/${eventId}/vod_archive.mp4`;
      event.recordingRetentionDays = 30; // 30-day retention policy
    }

    return event;
  }
}
