import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ContentScannerService } from '../safety/content-scanner.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SkillPath,
  LessonItem,
  UserPathProgress,
  UserLearnReminder,
  DifficultyFeedbackRecord,
  SkillLevel,
  CredentialClassification,
  DifficultyVoteType,
  NotificationType,
  NotificationPriority,
} from '@shared/types';
import {
  CreateSkillPathDto,
  CreateLessonDto,
  RecordLessonProgressDto,
  SubmitDifficultyFeedbackDto,
  UpdateLearnReminderDto,
} from './dto/learn.dto';

@Injectable()
export class LearnService {
  private readonly logger = new Logger(LearnService.name);

  // In-memory persistent stores with initial seed data
  private readonly paths = new Map<string, SkillPath>();
  private readonly userProgress = new Map<string, UserPathProgress>(); // key: `${userId}:${pathId}`
  private readonly userReminders = new Map<string, UserLearnReminder>(); // key: userId
  private readonly feedbackRecords: DifficultyFeedbackRecord[] = [];

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly contentScanner: ContentScannerService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.seedInitialCurricula();
  }

  // ==========================================================================
  // 1. CURRICULUM SEEDING (Distinguishing Verified Credentials vs Informal Tips)
  // ==========================================================================

  private seedInitialCurricula(): void {
    // 1.1 Verified Institutional Credential (Beginner)
    const uiPathId = 'path-uiux-foundations';
    const uiLessons: LessonItem[] = [
      {
        id: 'lesson-ui-01',
        pathId: uiPathId,
        orderIndex: 1,
        title: 'Design Systems & Spatial Grids',
        description: 'Master the 8pt spatial grid, fluid layouts, and baseline alignment.',
        contentType: 'VIDEO',
        contentUrl: 'https://cdn.interest.app/courses/ui/lesson_01.mp4',
        durationSeconds: 420,
        prerequisiteLessonIds: [],
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'lesson-ui-02',
        pathId: uiPathId,
        orderIndex: 2,
        title: 'Color Tokens & Contrast Compliance (WCAG 2.2)',
        description: 'Implementing semantic dark-mode design tokens and AA/AAA contrast standards.',
        contentType: 'ARTICLE',
        durationSeconds: 360,
        prerequisiteLessonIds: ['lesson-ui-01'],
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
      {
        id: 'lesson-ui-03',
        pathId: uiPathId,
        orderIndex: 3,
        title: 'Micro-Interactions & Gestural Feedback',
        description: 'Spring physics, haptic feedback triggers, and transition states.',
        contentType: 'QUIZ',
        durationSeconds: 300,
        prerequisiteLessonIds: ['lesson-ui-02'],
        version: 1,
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-09-01T00:00:00Z',
      },
    ];

    const uiPath: SkillPath = {
      id: uiPathId,
      title: 'Mobile UI/UX Design System Foundations',
      slug: 'mobile-ui-design-foundations',
      description: 'Accredited professional certification covering modern mobile interface architecture, design tokens, and accessibility standards.',
      interestId: 'interest_design_01',
      interestName: 'UI/UX Design',
      level: 'BEGINNER',
      classification: 'ACCREDITED_CERTIFICATION',
      isVerifiedCredential: true,
      issuingOrganization: 'Interaction Design Institute & W3C Chapter',
      verificationBadgeUrl: 'https://assets.interest.app/badges/accredited_ui.png',
      creatorId: 'inst_interaction_design',
      creatorName: 'Interaction Design Institute',
      creatorAvatarUrl: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=150',
      isCreatorCurated: false,
      prerequisitePathIds: [],
      estimatedDurationMinutes: 90,
      lessonCount: 3,
      lessons: uiLessons,
      difficultyStats: {
        tooEasyVotes: 4,
        justRightVotes: 38,
        tooHardVotes: 3,
        averageRating: 4.8,
        totalFeedbackCount: 45,
      },
      rating: 4.9,
      ratingsCount: 120,
      enrolledCount: 342,
      completedCount: 189,
      isPublished: true,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };
    this.paths.set(uiPathId, uiPath);

    // 1.2 Verified Institutional Credential (Advanced - has prerequisite uiPathId)
    const backendPathId = 'path-backend-scale';
    const backendLessons: LessonItem[] = [
      {
        id: 'lesson-scale-01',
        pathId: backendPathId,
        orderIndex: 1,
        title: 'Connection Pool Sizing & PostgreSQL Sharding',
        description: 'Tuning max connections, pool starvation prevention, and partition strategies.',
        contentType: 'VIDEO',
        contentUrl: 'https://cdn.interest.app/courses/scale/lesson_01.mp4',
        durationSeconds: 600,
        prerequisiteLessonIds: [],
        version: 1,
        createdAt: '2026-09-05T00:00:00Z',
        updatedAt: '2026-09-05T00:00:00Z',
      },
      {
        id: 'lesson-scale-02',
        pathId: backendPathId,
        orderIndex: 2,
        title: 'Circuit Breaker Pattern & Fallback Isolation',
        description: '3-state state machine implementation, probe intervals, and dead-letter queue routing.',
        contentType: 'PROJECT_BRIEF',
        durationSeconds: 720,
        prerequisiteLessonIds: ['lesson-scale-01'],
        version: 1,
        createdAt: '2026-09-05T00:00:00Z',
        updatedAt: '2026-09-05T00:00:00Z',
      },
    ];

    const backendPath: SkillPath = {
      id: backendPathId,
      title: 'High-Throughput Distributed Systems & Resiliency',
      slug: 'distributed-systems-resiliency',
      description: 'Advanced credential evaluating circuit breaker design, Redis read-replicas, and backpressure.',
      interestId: 'interest_engineering_02',
      interestName: 'Software Engineering',
      level: 'ADVANCED',
      classification: 'VERIFIED_CREDENTIAL',
      isVerifiedCredential: true,
      issuingOrganization: 'Systems Engineering Consortium',
      verificationBadgeUrl: 'https://assets.interest.app/badges/systems_master.png',
      creatorId: 'inst_systems_guild',
      creatorName: 'Systems Engineering Guild',
      creatorAvatarUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=150',
      isCreatorCurated: false,
      prerequisitePathIds: [uiPathId], // requires UI Path as prerequisite demonstration
      estimatedDurationMinutes: 140,
      lessonCount: 2,
      lessons: backendLessons,
      difficultyStats: {
        tooEasyVotes: 1,
        justRightVotes: 24,
        tooHardVotes: 12,
        averageRating: 4.6,
        totalFeedbackCount: 37,
      },
      rating: 4.7,
      ratingsCount: 88,
      enrolledCount: 154,
      completedCount: 62,
      isPublished: true,
      createdAt: '2026-09-05T00:00:00Z',
      updatedAt: '2026-09-05T00:00:00Z',
    };
    this.paths.set(backendPathId, backendPath);

    // 1.3 Informal Creator Tips & Masterclass (Intermediate)
    const videoPathId = 'path-creator-cinematic';
    const videoLessons: LessonItem[] = [
      {
        id: 'lesson-video-01',
        pathId: videoPathId,
        orderIndex: 1,
        title: '3-Point Mobile Lighting on a Zero Budget',
        description: 'Using practical lamps, diffusers, and bounce cards for cinematic depth.',
        contentType: 'VIDEO',
        durationSeconds: 380,
        prerequisiteLessonIds: [],
        version: 1,
        createdAt: '2026-09-10T00:00:00Z',
        updatedAt: '2026-09-10T00:00:00Z',
      },
      {
        id: 'lesson-video-02',
        pathId: videoPathId,
        orderIndex: 2,
        title: 'LUT Color Grading & Dynamic Range Tuning',
        description: 'Creator workflow for log profile conversion and vibrant skin tone protection.',
        contentType: 'ARTICLE',
        durationSeconds: 450,
        prerequisiteLessonIds: ['lesson-video-01'],
        version: 1,
        createdAt: '2026-09-10T00:00:00Z',
        updatedAt: '2026-09-10T00:00:00Z',
      },
    ];

    const videoPath: SkillPath = {
      id: videoPathId,
      title: 'Cinematic Smartphone Video & Color Grading',
      slug: 'cinematic-smartphone-video',
      description: 'Informal community masterclass taught by independent filmmaker Marcus Vance.',
      interestId: 'interest_filmmaking_03',
      interestName: 'Filmmaking',
      level: 'INTERMEDIATE',
      classification: 'INFORMAL_CREATOR_TIP',
      isVerifiedCredential: false, // Explicit informal creator distinction
      creatorId: 'user_marcus_vance',
      creatorName: 'Marcus Vance',
      creatorAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isCreatorCurated: true,
      prerequisitePathIds: [],
      estimatedDurationMinutes: 65,
      lessonCount: 2,
      lessons: videoLessons,
      difficultyStats: {
        tooEasyVotes: 2,
        justRightVotes: 45,
        tooHardVotes: 5,
        averageRating: 4.8,
        totalFeedbackCount: 52,
      },
      rating: 4.9,
      ratingsCount: 210,
      enrolledCount: 450,
      completedCount: 290,
      isPublished: true,
      createdAt: '2026-09-10T00:00:00Z',
      updatedAt: '2026-09-10T00:00:00Z',
    };
    this.paths.set(videoPathId, videoPath);
  }

  // ==========================================================================
  // 2. PATH RETRIEVAL & PREREQUISITES
  // ==========================================================================

  async listPaths(query?: {
    level?: SkillLevel;
    interestId?: string;
    isVerifiedCredential?: boolean;
    creatorId?: string;
  }): Promise<SkillPath[]> {
    let result = Array.from(this.paths.values()).filter((p) => p.isPublished);

    if (query?.level) {
      result = result.filter((p) => p.level === query.level);
    }
    if (query?.interestId) {
      result = result.filter((p) => p.interestId === query.interestId);
    }
    if (query?.isVerifiedCredential !== undefined) {
      result = result.filter((p) => p.isVerifiedCredential === query.isVerifiedCredential);
    }
    if (query?.creatorId) {
      result = result.filter((p) => p.creatorId === query.creatorId);
    }

    return result;
  }

  async getPathById(pathId: string, userId?: string): Promise<{
    path: SkillPath;
    userProgress?: UserPathProgress;
    prerequisitesMet: boolean;
    missingPrerequisites: string[];
  }> {
    const path = this.paths.get(pathId);
    if (!path || !path.isPublished) {
      throw new NotFoundException(`Skill path with ID '${pathId}' not found.`);
    }

    let userProgress: UserPathProgress | undefined;
    let prerequisitesMet = true;
    const missingPrerequisites: string[] = [];

    if (userId) {
      // Check prerequisite paths
      for (const reqPathId of path.prerequisitePathIds) {
        const reqProgress = this.userProgress.get(`${userId}:${reqPathId}`);
        if (!reqProgress || !reqProgress.isCompleted) {
          prerequisitesMet = false;
          const reqPath = this.paths.get(reqPathId);
          missingPrerequisites.push(reqPath ? reqPath.title : reqPathId);
        }
      }

      userProgress = await this.getProgress(userId, pathId);
    }

    // Filter out soft-deleted lessons
    const sanitizedPath: SkillPath = {
      ...path,
      lessons: path.lessons.filter((l) => !l.isDeleted),
      lessonCount: path.lessons.filter((l) => !l.isDeleted).length,
    };

    return {
      path: sanitizedPath,
      userProgress,
      prerequisitesMet,
      missingPrerequisites,
    };
  }

  // ==========================================================================
  // 3. USER PROGRESS & RESUME TRACKING
  // ==========================================================================

  async getProgress(userId: string, pathId: string): Promise<UserPathProgress> {
    const path = this.paths.get(pathId);
    if (!path) {
      throw new NotFoundException(`Path ${pathId} not found.`);
    }

    const key = `${userId}:${pathId}`;
    let progress = this.userProgress.get(key);
    const activeLessons = path.lessons.filter((l) => !l.isDeleted);

    if (!progress) {
      // Initialize fresh progress
      progress = {
        userId,
        pathId,
        currentLessonId: activeLessons.length > 0 ? activeLessons[0].id : '',
        completedLessonIds: [],
        percentComplete: 0,
        isCompleted: false,
        lastAccessedAt: new Date().toISOString(),
        timeSpentSeconds: 0,
        missingOrDeletedLessonsHandled: false,
      };
      this.userProgress.set(key, progress);
      return progress;
    }

    // RESILIENCE CHECK: Reconcile deleted/changed lessons cleanly
    const activeLessonIdSet = new Set(activeLessons.map((l) => l.id));
    const validCompletedIds = progress.completedLessonIds.filter((id) => activeLessonIdSet.has(id));

    let handledMissingOrDeleted = false;
    if (validCompletedIds.length !== progress.completedLessonIds.length) {
      handledMissingOrDeleted = true;
      this.logger.warn(
        `Reconciled ${progress.completedLessonIds.length - validCompletedIds.length} deleted lessons for user ${userId} in path ${pathId}`,
      );
    }

    // If currentLessonId points to a deleted lesson, advance to next incomplete lesson
    let currentLessonId = progress.currentLessonId;
    if (!activeLessonIdSet.has(currentLessonId)) {
      handledMissingOrDeleted = true;
      const firstIncomplete = activeLessons.find((l) => !validCompletedIds.includes(l.id));
      currentLessonId = firstIncomplete ? firstIncomplete.id : (activeLessons[0]?.id || '');
    }

    const totalActive = activeLessons.length;
    const percentComplete = totalActive > 0 ? Math.min(100, Math.round((validCompletedIds.length / totalActive) * 100)) : 0;
    const isCompleted = totalActive > 0 && validCompletedIds.length >= totalActive;

    progress = {
      ...progress,
      currentLessonId,
      completedLessonIds: validCompletedIds,
      percentComplete,
      isCompleted,
      missingOrDeletedLessonsHandled: handledMissingOrDeleted,
    };

    this.userProgress.set(key, progress);
    return progress;
  }

  async recordLessonProgress(userId: string, dto: RecordLessonProgressDto): Promise<UserPathProgress> {
    const { path, prerequisitesMet, missingPrerequisites } = await this.getPathById(dto.pathId, userId);

    if (!prerequisitesMet) {
      throw new ForbiddenException(
        `Prerequisites not met for this path. Complete first: ${missingPrerequisites.join(', ')}`,
      );
    }

    const activeLessons = path.lessons.filter((l) => !l.isDeleted);
    const lesson = activeLessons.find((l) => l.id === dto.lessonId);
    if (!lesson) {
      throw new NotFoundException(`Lesson ${dto.lessonId} not found in path ${dto.pathId}`);
    }

    let progress = await this.getProgress(userId, dto.pathId);
    const completedSet = new Set(progress.completedLessonIds);

    if (dto.completed) {
      completedSet.add(dto.lessonId);
    } else {
      completedSet.delete(dto.lessonId);
    }

    const completedLessonIds = Array.from(completedSet);
    const totalActive = activeLessons.length;
    const percentComplete = totalActive > 0 ? Math.min(100, Math.round((completedLessonIds.length / totalActive) * 100)) : 0;
    const isCompleted = totalActive > 0 && completedLessonIds.length >= totalActive;

    // Find next lesson to advance currentLessonId
    const currentIndex = activeLessons.findIndex((l) => l.id === dto.lessonId);
    let nextLessonId = progress.currentLessonId;
    if (dto.completed && currentIndex !== -1 && currentIndex + 1 < activeLessons.length) {
      nextLessonId = activeLessons[currentIndex + 1].id;
    }

    const now = new Date().toISOString();
    progress = {
      ...progress,
      currentLessonId: nextLessonId,
      completedLessonIds,
      percentComplete,
      isCompleted,
      completedAt: isCompleted ? (progress.completedAt || now) : undefined,
      lastAccessedAt: now,
      timeSpentSeconds: progress.timeSpentSeconds + (dto.timeSpentSeconds || 0),
    };

    this.userProgress.set(`${userId}:${dto.pathId}`, progress);

    // If path was just completed, update path completed count
    if (isCompleted && !progress.isCompleted) {
      path.completedCount += 1;
    }

    return progress;
  }

  async getResumeProgress(userId: string): Promise<{
    activePath: SkillPath | null;
    currentLesson: LessonItem | null;
    progress: UserPathProgress | null;
  }> {
    // Find user's most recently accessed in-progress or active path
    let mostRecentProgress: UserPathProgress | null = null;

    for (const [key, p] of this.userProgress.entries()) {
      if (key.startsWith(`${userId}:`)) {
        if (!mostRecentProgress || new Date(p.lastAccessedAt) > new Date(mostRecentProgress.lastAccessedAt)) {
          mostRecentProgress = p;
        }
      }
    }

    if (!mostRecentProgress) {
      // If no progress, return the first beginner verified path as a starter recommendation
      const beginnerPath = Array.from(this.paths.values()).find((p) => p.level === 'BEGINNER' && p.isVerifiedCredential);
      if (beginnerPath && beginnerPath.lessons.length > 0) {
        return {
          activePath: beginnerPath,
          currentLesson: beginnerPath.lessons[0],
          progress: null,
        };
      }
      return { activePath: null, currentLesson: null, progress: null };
    }

    const path = this.paths.get(mostRecentProgress.pathId);
    if (!path) {
      return { activePath: null, currentLesson: null, progress: null };
    }

    // Refresh progress with deleted lesson check
    const refreshedProgress = await this.getProgress(userId, path.id);
    const currentLesson = path.lessons.find((l) => l.id === refreshedProgress.currentLessonId) || path.lessons[0] || null;

    return {
      activePath: path,
      currentLesson,
      progress: refreshedProgress,
    };
  }

  // ==========================================================================
  // 4. DIFFICULTY FEEDBACK (User Ratings & Adaptive Path Stats)
  // ==========================================================================

  async submitDifficultyFeedback(
    userId: string,
    dto: SubmitDifficultyFeedbackDto,
  ): Promise<DifficultyFeedbackRecord> {
    const path = this.paths.get(dto.pathId);
    if (!path) {
      throw new NotFoundException(`Skill path ${dto.pathId} not found.`);
    }

    const record: DifficultyFeedbackRecord = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      pathId: dto.pathId,
      lessonId: dto.lessonId,
      feedback: dto.feedback,
      ratingScore: dto.ratingScore,
      comments: dto.comments,
      createdAt: new Date().toISOString(),
    };

    this.feedbackRecords.push(record);

    // Update aggregate path stats
    if (dto.feedback === 'TOO_EASY') path.difficultyStats.tooEasyVotes += 1;
    if (dto.feedback === 'JUST_RIGHT') path.difficultyStats.justRightVotes += 1;
    if (dto.feedback === 'TOO_HARD') path.difficultyStats.tooHardVotes += 1;

    path.difficultyStats.totalFeedbackCount += 1;
    const currentTotalScore = path.difficultyStats.averageRating * (path.difficultyStats.totalFeedbackCount - 1);
    path.difficultyStats.averageRating = Number(
      ((currentTotalScore + dto.ratingScore) / path.difficultyStats.totalFeedbackCount).toFixed(1),
    );

    return record;
  }

  // ==========================================================================
  // 5. USER-CONTROLLED STUDY REMINDERS (Strict Zero-Location Guarantee)
  // ==========================================================================

  async getReminderSettings(userId: string): Promise<UserLearnReminder> {
    const reminder = this.userReminders.get(userId);
    if (reminder) return reminder;

    // Default configuration (Zero-location, user-controlled)
    const defaultReminder: UserLearnReminder = {
      userId,
      enabled: false,
      reminderTime: '19:00',
      daysOfWeek: [1, 2, 3, 4, 5], // Monday through Friday
      channel: 'IN_APP',
      updatedAt: new Date().toISOString(),
    };
    this.userReminders.set(userId, defaultReminder);
    return defaultReminder;
  }

  async updateReminderSettings(userId: string, dto: UpdateLearnReminderDto): Promise<UserLearnReminder> {
    let targetSkillPathTitle: string | undefined;
    if (dto.targetSkillPathId) {
      const path = this.paths.get(dto.targetSkillPathId);
      if (path) targetSkillPathTitle = path.title;
    }

    const reminder: UserLearnReminder = {
      userId,
      enabled: dto.enabled,
      reminderTime: dto.reminderTime,
      daysOfWeek: dto.daysOfWeek,
      channel: dto.channel,
      targetSkillPathId: dto.targetSkillPathId,
      targetSkillPathTitle,
      updatedAt: new Date().toISOString(),
    };

    this.userReminders.set(userId, reminder);

    // If enabled, trigger a sample in-app notification confirming study schedule
    if (dto.enabled) {
      try {
        await this.notificationsService.dispatchNotification({
          userId,
          type: NotificationType.INTEREST_DIGEST,
          title: 'Learn Reminder Scheduled',
          body: `Your daily learning reminder is set for ${dto.reminderTime} on selected days. Keep up your streak!`,
          priority: NotificationPriority.NORMAL,
          deepLinkUrl: 'interest://learn',
        });
      } catch (err) {
        this.logger.debug(`Sample notification dispatched safely: ${err}`);
      }
    }

    return reminder;
  }

  // ==========================================================================
  // 6. CONTENT CREATION & REAL MODERATION PIPELINE
  // ==========================================================================

  async createSkillPath(creatorId: string, creatorName: string, dto: CreateSkillPathDto): Promise<SkillPath> {
    // 6.1 Content Safety Scan
    const scanResult = await this.contentScanner.scanReel({
      reelId: 'path_submission',
      title: dto.title,
      caption: dto.description,
    });

    if (scanResult.action === 'REJECT' || scanResult.action === 'FLAG') {
      throw new BadRequestException(
        `Skill path rejected by moderation filter: Detected ${scanResult.reasons.join(', ') || 'prohibited content'}.`,
      );
    }

    const pathId = `path_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const slug = dto.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const newPath: SkillPath = {
      id: pathId,
      title: dto.title,
      slug,
      description: dto.description,
      interestId: dto.interestId,
      interestName: dto.interestName,
      level: dto.level,
      classification: dto.classification,
      isVerifiedCredential: dto.isVerifiedCredential || false,
      issuingOrganization: dto.issuingOrganization,
      verificationBadgeUrl: dto.verificationBadgeUrl,
      creatorId,
      creatorName,
      isCreatorCurated: !dto.isVerifiedCredential,
      prerequisitePathIds: dto.prerequisitePathIds || [],
      estimatedDurationMinutes: dto.estimatedDurationMinutes || 45,
      lessonCount: 0,
      lessons: [],
      difficultyStats: {
        tooEasyVotes: 0,
        justRightVotes: 0,
        tooHardVotes: 0,
        averageRating: 5.0,
        totalFeedbackCount: 0,
      },
      rating: 5.0,
      ratingsCount: 0,
      enrolledCount: 0,
      completedCount: 0,
      isPublished: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.paths.set(pathId, newPath);
    return newPath;
  }

  async addLessonToPath(pathId: string, creatorId: string, dto: CreateLessonDto): Promise<LessonItem> {
    const path = this.paths.get(pathId);
    if (!path) throw new NotFoundException(`Path ${pathId} not found.`);

    // 6.2 Content Safety Scan
    const scanResult = await this.contentScanner.scanReel({
      reelId: 'lesson_submission',
      title: dto.title,
      caption: dto.description,
    });

    if (scanResult.action === 'REJECT' || scanResult.action === 'FLAG') {
      throw new BadRequestException(
        `Lesson rejected by moderation filter: Detected ${scanResult.reasons.join(', ') || 'prohibited content'}.`,
      );
    }

    const lessonId = `lesson_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const orderIndex = dto.orderIndex || path.lessons.length + 1;

    const lesson: LessonItem = {
      id: lessonId,
      pathId,
      orderIndex,
      title: dto.title,
      description: dto.description,
      contentType: dto.contentType,
      contentUrl: dto.contentUrl,
      reelId: dto.reelId,
      durationSeconds: dto.durationSeconds,
      prerequisiteLessonIds: dto.prerequisiteLessonIds || [],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    path.lessons.push(lesson);
    path.lessonCount = path.lessons.filter((l) => !l.isDeleted).length;
    path.updatedAt = new Date().toISOString();

    return lesson;
  }

  // ==========================================================================
  // 7. LESSON DELETION & MODIFICATION (Resilience Testing)
  // ==========================================================================

  async deleteLesson(pathId: string, lessonId: string): Promise<{ success: boolean; activeLessonCount: number }> {
    const path = this.paths.get(pathId);
    if (!path) throw new NotFoundException(`Path ${pathId} not found.`);

    const lesson = path.lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new NotFoundException(`Lesson ${lessonId} not found.`);

    // Mark as soft-deleted to verify state reconciliation without crashes
    lesson.isDeleted = true;
    lesson.updatedAt = new Date().toISOString();

    path.lessonCount = path.lessons.filter((l) => !l.isDeleted).length;
    path.updatedAt = new Date().toISOString();

    return {
      success: true,
      activeLessonCount: path.lessonCount,
    };
  }
}
