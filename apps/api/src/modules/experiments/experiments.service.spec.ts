import { Test, TestingModule } from '@nestjs/testing';
import { ExperimentsService } from './experiments.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { DatabaseService } from '../../database/database.service';
import { ExperimentStatus } from '@shared/types';

describe('ExperimentsService (A/B Testing & Feed Variants)', () => {
  let service: ExperimentsService;
  let mockDatabaseService: any;
  let mockAnalyticsService: any;

  beforeEach(async () => {
    mockDatabaseService = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };

    mockAnalyticsService = {
      trackEvent: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperimentsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();

    service = module.get<ExperimentsService>(ExperimentsService);
  });

  describe('Deterministic Variant Bucketing', () => {
    it('should assign a user deterministically and stickily across multiple queries', async () => {
      const userId = 'user-test-uuid-42';

      const run1 = await service.getVariantForUser(userId, 'feed_ranking_algorithm');
      const run2 = await service.getVariantForUser(userId, 'feed_ranking_algorithm');
      const run3 = await service.getVariantForUser(userId, 'feed_ranking_algorithm');

      expect(run1.variantId).toBe(run2.variantId);
      expect(run2.variantId).toBe(run3.variantId);
      expect(['control', 'variant_affinity_boost', 'variant_pwt_optimized']).toContain(run1.variantId);
    });

    it('should assign different users to distinct variants according to distribution weights', async () => {
      const assignedVariants = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const res = await service.getVariantForUser(`user-cohort-sim-${i}`, 'feed_ranking_algorithm');
        assignedVariants.add(res.variantId);
      }

      // Over 50 simulated users, all 3 variants should be assigned
      expect(assignedVariants.has('control')).toBe(true);
      expect(assignedVariants.has('variant_affinity_boost')).toBe(true);
      expect(assignedVariants.has('variant_pwt_optimized')).toBe(true);
    });
  });

  describe('QA Developer / Tester Override', () => {
    it('should respect QA developer override regardless of deterministic hash', async () => {
      const userId = 'qa-engineer-01';

      service.setOverride('feed_ranking_algorithm', userId, 'variant_affinity_boost');

      const assigned = await service.getVariantForUser(userId, 'feed_ranking_algorithm');
      expect(assigned.variantId).toBe('variant_affinity_boost');
      expect(assigned.config.weightMatch).toBe(0.55);

      // Clear override
      service.clearOverride('feed_ranking_algorithm', userId);
    });
  });

  describe('Composite Feed Ranking Config', () => {
    it('should resolve ranking weights and exploration ratio for FeedService', async () => {
      const config = await service.getFeedRankingConfig('user-viewer-88');

      expect(config.weights).toBeDefined();
      expect(config.weights.weightMatch).toBeGreaterThan(0);
      expect(config.weights.weightPwt).toBeGreaterThan(0);
      expect(config.weights.weightEngagement).toBeGreaterThan(0);
      expect(config.weights.weightFreshness).toBeGreaterThan(0);
      expect(config.explorationRatio).toBeGreaterThan(0);
      expect(config.rankingVariantId).toBeDefined();
      expect(config.explorationVariantId).toBeDefined();
    });
  });

  describe('Statistical Significance & Evaluation', () => {
    it('should evaluate experiment results, relative lifts, and significance flags', async () => {
      const evaluation = await service.evaluateExperiment('feed_ranking_algorithm');

      expect(evaluation.experiment.id).toBe('feed_ranking_algorithm');
      expect(evaluation.totalParticipants).toBeGreaterThan(20000);
      expect(evaluation.variants).toHaveLength(3);

      const control = evaluation.variants.find((v) => v.isControl);
      const testAffinity = evaluation.variants.find((v) => v.variantId === 'variant_affinity_boost');

      expect(control).toBeDefined();
      expect(testAffinity).toBeDefined();
      expect(testAffinity!.relativeLiftPct).toBeGreaterThan(10.0); // +18.3% lift
      expect(testAffinity!.isStatisticallySignificant).toBe(true); // p < 0.05
      expect(evaluation.winnerVariantId).toBe('variant_affinity_boost');
    });

    it('should list all registered experiments', async () => {
      const all = await service.listExperiments();
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all.some((e) => e.experiment.id === 'feed_ranking_algorithm')).toBe(true);
      expect(all.some((e) => e.experiment.id === 'feed_exploration_ratio')).toBe(true);
    });

    it('should conclude an experiment with a chosen winner', async () => {
      const concluded = await service.concludeExperiment(
        'feed_exploration_ratio',
        'variant_serendipity',
      );

      expect(concluded.status).toBe(ExperimentStatus.CONCLUDED);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE experiments SET status'),
        ['feed_exploration_ratio'],
      );
    });
  });
});
