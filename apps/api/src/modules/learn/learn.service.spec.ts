import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LearnService } from './learn.service';
import { DatabaseService } from '../../database/database.service';
import { ContentScannerService } from '../safety/content-scanner.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('LearnService (Prompt 25 — Learn Mode)', () => {
  let service: LearnService;
  let mockContentScanner: any;
  let mockNotificationsService: any;
  let mockDatabaseService: any;

  beforeEach(async () => {
    mockDatabaseService = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    mockContentScanner = {
      scanReel: jest.fn().mockImplementation(async (metadata: any) => {
        // Simulating safety scan: flag if contains "terror" or "profanity"
        const text = (metadata.title + ' ' + (metadata.caption || '')).toLowerCase();
        if (text.includes('terror') || text.includes('fuck')) {
          return {
            action: 'REJECT',
            reasons: ['VIOLENCE_OR_HATE_SPEECH'],
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
        LearnService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ContentScannerService, useValue: mockContentScanner },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<LearnService>(LearnService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('1. Structured Skill Paths & Credential Distinction', () => {
    it('should seed Beginner, Intermediate, and Advanced skill paths', async () => {
      const allPaths = await service.listPaths();
      expect(allPaths.length).toBeGreaterThanOrEqual(3);

      const beginner = allPaths.find((p) => p.level === 'BEGINNER');
      const intermediate = allPaths.find((p) => p.level === 'INTERMEDIATE');
      const advanced = allPaths.find((p) => p.level === 'ADVANCED');

      expect(beginner).toBeDefined();
      expect(intermediate).toBeDefined();
      expect(advanced).toBeDefined();
    });

    it('should clearly distinguish verified credentials from informal creator content', async () => {
      const verifiedPaths = await service.listPaths({ isVerifiedCredential: true });
      const creatorPaths = await service.listPaths({ isVerifiedCredential: false });

      expect(verifiedPaths.length).toBeGreaterThanOrEqual(2);
      expect(creatorPaths.length).toBeGreaterThanOrEqual(1);

      // Institutional verified credential checks
      const uiCert = verifiedPaths.find((p) => p.id === 'path-uiux-foundations');
      expect(uiCert?.isVerifiedCredential).toBe(true);
      expect(uiCert?.classification).toBe('ACCREDITED_CERTIFICATION');
      expect(uiCert?.issuingOrganization).toContain('Interaction Design Institute');
      expect(uiCert?.verificationBadgeUrl).toBeDefined();

      // Informal creator guide checks
      const creatorVideo = creatorPaths.find((p) => p.id === 'path-creator-cinematic');
      expect(creatorVideo?.isVerifiedCredential).toBe(false);
      expect(creatorVideo?.isCreatorCurated).toBe(true);
      expect(creatorVideo?.classification).toBe('INFORMAL_CREATOR_TIP');
      expect(creatorVideo?.creatorName).toBe('Marcus Vance');
    });
  });

  describe('2. Prerequisites Enforcement', () => {
    const testUserId = 'test-user-learner-001';

    it('should identify unmet prerequisites for advanced paths', async () => {
      const pathDetails = await service.getPathById('path-backend-scale', testUserId);
      expect(pathDetails.prerequisitesMet).toBe(false);
      expect(pathDetails.missingPrerequisites).toContain('Mobile UI/UX Design System Foundations');
    });

    it('should block recording progress on locked prerequisite paths', async () => {
      await expect(
        service.recordLessonProgress(testUserId, {
          pathId: 'path-backend-scale',
          lessonId: 'lesson-scale-01',
          completed: true,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow progress once prerequisites are completed', async () => {
      // 1. Complete prerequisite UI path lessons
      await service.recordLessonProgress(testUserId, {
        pathId: 'path-uiux-foundations',
        lessonId: 'lesson-ui-01',
        completed: true,
      });
      await service.recordLessonProgress(testUserId, {
        pathId: 'path-uiux-foundations',
        lessonId: 'lesson-ui-02',
        completed: true,
      });
      await service.recordLessonProgress(testUserId, {
        pathId: 'path-uiux-foundations',
        lessonId: 'lesson-ui-03',
        completed: true,
      });

      // 2. Now check backend path prerequisites
      const pathDetails = await service.getPathById('path-backend-scale', testUserId);
      expect(pathDetails.prerequisitesMet).toBe(true);
      expect(pathDetails.missingPrerequisites.length).toBe(0);

      // 3. Should now successfully record progress on backend path
      const backendProgress = await service.recordLessonProgress(testUserId, {
        pathId: 'path-backend-scale',
        lessonId: 'lesson-scale-01',
        completed: true,
      });
      expect(backendProgress.percentComplete).toBe(50);
    });
  });

  describe('3. Resume Progress & Tracking', () => {
    const resumeUserId = 'test-user-resume-999';

    it('should track progress percentage and advance current lesson ID', async () => {
      const p1 = await service.recordLessonProgress(resumeUserId, {
        pathId: 'path-creator-cinematic',
        lessonId: 'lesson-video-01',
        completed: true,
        timeSpentSeconds: 380,
      });

      expect(p1.percentComplete).toBe(50);
      expect(p1.completedLessonIds).toContain('lesson-video-01');
      expect(p1.currentLessonId).toBe('lesson-video-02');
      expect(p1.isCompleted).toBe(false);

      const resume = await service.getResumeProgress(resumeUserId);
      expect(resume.activePath?.id).toBe('path-creator-cinematic');
      expect(resume.currentLesson?.id).toBe('lesson-video-02');
      expect(resume.progress?.percentComplete).toBe(50);
    });
  });

  describe('4. Resilience to Deleted / Changed Lessons', () => {
    const resilientUserId = 'test-user-resilience-123';

    it('should gracefully handle deleted lessons without corrupting progress state', async () => {
      // 1. Create a custom test path with 3 lessons
      const newPath = await service.createSkillPath('creator-resilient', 'Resilient Coach', {
        title: 'Architectural Systems Test',
        description: 'Testing lesson deletion and modification resilience.',
        interestId: 'int_eng',
        interestName: 'Engineering',
        level: 'BEGINNER',
        classification: 'COMMUNITY_WORKSHOP',
      });

      const l1 = await service.addLessonToPath(newPath.id, 'creator-resilient', {
        title: 'Module 1 - Setup',
        description: 'Initial config and tools.',
        contentType: 'VIDEO',
        durationSeconds: 120,
      });

      const l2 = await service.addLessonToPath(newPath.id, 'creator-resilient', {
        title: 'Module 2 - Implementation',
        description: 'Writing code.',
        contentType: 'ARTICLE',
        durationSeconds: 180,
      });

      const l3 = await service.addLessonToPath(newPath.id, 'creator-resilient', {
        title: 'Module 3 - Verification',
        description: 'Running tests.',
        contentType: 'QUIZ',
        durationSeconds: 150,
      });

      // 2. User completes lesson 1 and lesson 2
      await service.recordLessonProgress(resilientUserId, {
        pathId: newPath.id,
        lessonId: l1.id,
        completed: true,
      });
      await service.recordLessonProgress(resilientUserId, {
        pathId: newPath.id,
        lessonId: l2.id,
        completed: true,
      });

      let progress = await service.getProgress(resilientUserId, newPath.id);
      expect(progress.percentComplete).toBe(67); // 2 out of 3

      // 3. Creator deletes lesson 2!
      await service.deleteLesson(newPath.id, l2.id);

      // 4. Fetch user progress again -> must not crash, must reconcile deleted lesson
      progress = await service.getProgress(resilientUserId, newPath.id);

      expect(progress.missingOrDeletedLessonsHandled).toBe(true);
      // Valid completed lessons should now only contain l1
      expect(progress.completedLessonIds).toEqual([l1.id]);
      // Active lessons are now 2 (l1 and l3). 1 out of 2 = 50%
      expect(progress.percentComplete).toBe(50);
      expect(progress.currentLessonId).toBe(l3.id);
    });
  });

  describe('5. Real Content Moderation', () => {
    it('should reject skill paths with prohibited or violent content', async () => {
      await expect(
        service.createSkillPath('user-bad', 'Violator', {
          title: 'How to commit terror attack',
          description: 'Harmful instructions.',
          interestId: 'int_bad',
          interestName: 'Bad',
          level: 'BEGINNER',
          classification: 'COMMUNITY_WORKSHOP',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow legitimate educational content to be published', async () => {
      const validPath = await service.createSkillPath('user-good', 'Master Educator', {
        title: 'Advanced Machine Learning Geometry',
        description: 'A deep dive into manifold learning, PCA, and high-dimensional spaces.',
        interestId: 'int_ml',
        interestName: 'Machine Learning',
        level: 'ADVANCED',
        classification: 'COMMUNITY_WORKSHOP',
      });

      expect(validPath).toBeDefined();
      expect(validPath.title).toBe('Advanced Machine Learning Geometry');
    });
  });

  describe('6. Difficulty Feedback', () => {
    const feedbackUser = 'test-user-feedback-777';

    it('should record user difficulty votes and update path aggregates', async () => {
      const pathId = 'path-uiux-foundations';
      const initialPath = (await service.getPathById(pathId)).path;
      const initialTotal = initialPath.difficultyStats.totalFeedbackCount;

      const record = await service.submitDifficultyFeedback(feedbackUser, {
        pathId,
        feedback: 'JUST_RIGHT',
        ratingScore: 5,
        comments: 'Excellent progression and real-world examples!',
      });

      expect(record.id).toBeDefined();
      expect(record.feedback).toBe('JUST_RIGHT');

      const updatedPath = (await service.getPathById(pathId)).path;
      expect(updatedPath.difficultyStats.totalFeedbackCount).toBe(initialTotal + 1);
    });
  });

  describe('7. User-Controlled Study Reminders (Zero-Location Invariant)', () => {
    const reminderUser = 'test-user-remind-444';

    it('should manage study reminder settings and trigger notifications without location data', async () => {
      const initial = await service.getReminderSettings(reminderUser);
      expect(initial.enabled).toBe(false);

      const updated = await service.updateReminderSettings(reminderUser, {
        enabled: true,
        reminderTime: '20:15',
        daysOfWeek: [1, 2, 3, 4, 5],
        channel: 'IN_APP',
        targetSkillPathId: 'path-uiux-foundations',
      });

      expect(updated.enabled).toBe(true);
      expect(updated.reminderTime).toBe('20:15');
      expect(updated.targetSkillPathTitle).toBe('Mobile UI/UX Design System Foundations');

      // Verify notification dispatched
      expect(mockNotificationsService.dispatchNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: reminderUser,
          title: 'Learn Reminder Scheduled',
        }),
      );

      // Guarantee ZERO location metadata in payload
      const reminderKeys = Object.keys(updated);
      expect(reminderKeys).not.toContain('latitude');
      expect(reminderKeys).not.toContain('longitude');
      expect(reminderKeys).not.toContain('gps');
      expect(reminderKeys).not.toContain('country');
      expect(reminderKeys).not.toContain('ip');
    });
  });
});
