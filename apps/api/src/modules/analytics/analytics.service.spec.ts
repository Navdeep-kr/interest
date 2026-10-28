import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PostHogClientAdapter } from './posthog-client.adapter';
import { DatabaseService } from '../../database/database.service';
import { AnalyticsEventName } from '@shared/types';

describe('AnalyticsService (Zero-Location Telemetry)', () => {
  let service: AnalyticsService;
  let mockDatabaseService: any;
  let mockPostHogAdapter: any;

  beforeEach(async () => {
    mockDatabaseService = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      getClient: jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      }),
    };

    mockPostHogAdapter = {
      capture: jest.fn().mockResolvedValue(true),
      captureBatch: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: PostHogClientAdapter, useValue: mockPostHogAdapter },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('Event Tracking & Zero-Location Sanitization', () => {
    it('should successfully ingest an analytics event and forward to PostHog', async () => {
      const res = await service.trackEvent({
        eventName: AnalyticsEventName.FEED_VIEWED,
        userId: 'user-uuid-1',
        properties: {
          feedMode: 'FOR_YOU',
          batchSize: 10,
        },
      });

      expect(res.success).toBe(true);
      expect(res.eventId).toBeDefined();
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(1);
      expect(mockPostHogAdapter.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AnalyticsEventName.FEED_VIEWED,
          distinctId: 'user-uuid-1',
          properties: expect.objectContaining({ feedMode: 'FOR_YOU' }),
        }),
      );
    });

    it('should strip any accidental geographic coordinates from properties before saving', async () => {
      await service.trackEvent({
        eventName: AnalyticsEventName.APP_INSTALLED,
        userId: 'user-uuid-2',
        properties: {
          clientVersion: '1.0.0',
          lat: 37.7749,
          lng: -122.4194,
          city: 'San Francisco',
        },
      });

      const dbCallArgs = mockDatabaseService.query.mock.calls[0][1];
      const savedProps = JSON.parse(dbCallArgs[4]);

      expect(savedProps.clientVersion).toBe('1.0.0');
      expect(savedProps.lat).toBeUndefined();
      expect(savedProps.lng).toBeUndefined();
      expect(savedProps.city).toBeUndefined();
    });

    it('should ingest a batch of events within a database transaction', async () => {
      const res = await service.trackBatch({
        events: [
          {
            eventName: AnalyticsEventName.ONBOARDING_STARTED,
            userId: 'user-uuid-3',
          },
          {
            eventName: AnalyticsEventName.ONBOARDING_COMPLETED,
            userId: 'user-uuid-3',
            properties: { selectedCount: 5 },
          },
        ],
      });

      expect(res.processed).toBe(2);
      expect(mockPostHogAdapter.captureBatch).toHaveBeenCalled();
    });
  });

  describe('Activation & Creation Funnel Analysis', () => {
    it('should calculate step counts, conversion rates, and drop-offs for Install -> Onboarding -> First Reel -> First Post', async () => {
      const funnel = await service.getInstallToPostFunnel();

      expect(funnel.funnelName).toBe('Activation & Creation Funnel');
      expect(funnel.steps).toHaveLength(4);

      // Verify Step 1: Install
      expect(funnel.steps[0].stepName).toBe('App Installed');
      expect(funnel.steps[0].conversionRateFromPrev).toBe(1.0);

      // Verify Step 2: Onboarding
      expect(funnel.steps[1].stepName).toBe('Onboarding Completed');
      expect(funnel.steps[1].conversionRateFromPrev).toBeGreaterThan(0.7);
      expect(funnel.steps[1].dropoffCount).toBeGreaterThan(0);

      // Verify Step 3: First Reel
      expect(funnel.steps[2].stepName).toBe('First Reel Watched');
      expect(funnel.steps[2].conversionRateFromPrev).toBeGreaterThan(0.8);

      // Verify Step 4: First Post
      expect(funnel.steps[3].stepName).toBe('First Reel Published');
      expect(funnel.overallConversionRate).toBe(funnel.steps[3].conversionRateFromStart);
      expect(funnel.segments).toBeDefined();
      expect(funnel.segments!.length).toBeGreaterThan(0);
    });
  });

  describe('N-Day Cohort Retention', () => {
    it('should return cohort retention heatmap and depth breakdown', async () => {
      const retention = await service.getRetentionCohorts();

      expect(retention.averageDay1).toBeGreaterThan(60);
      expect(retention.averageDay7).toBeGreaterThan(40);
      expect(retention.averageDay30).toBeGreaterThan(25);
      expect(retention.cohorts.length).toBeGreaterThanOrEqual(7);

      const firstCohort = retention.cohorts[0];
      expect(firstCohort.day0Pct).toBe(100.0);
      expect(firstCohort.day1Pct).toBeGreaterThan(firstCohort.day7Pct);
      expect(firstCohort.day7Pct).toBeGreaterThan(firstCohort.day30Pct);

      // Verify depth breakdown (users with 6+ interests retain best)
      const depth = retention.depthBreakdown;
      const shallow = depth.find((d) => d.interestCountTier === '1-2 Interests');
      const deep = depth.find((d) => d.interestCountTier === '6+ Interests');
      expect(deep!.day30Pct).toBeGreaterThan(shallow!.day30Pct);
    });
  });

  describe('Interest-Match Satisfaction Telemetry', () => {
    it('should compute Interest Satisfaction Index (ISI) and calibration errors', async () => {
      const satisfaction = await service.getInterestMatchSatisfaction();

      expect(satisfaction.overallSatisfactionIndex).toBeGreaterThan(80);
      expect(satisfaction.topSatisfiedInterests.length).toBeGreaterThan(0);
      expect(satisfaction.bottomSatisfiedInterests.length).toBeGreaterThan(0);

      const top = satisfaction.topSatisfiedInterests[0];
      const bottom = satisfaction.bottomSatisfiedInterests[0];

      expect(top.interestSatisfactionIndex).toBeGreaterThan(bottom.interestSatisfactionIndex);
      expect(top.completionRatePct).toBeGreaterThan(bottom.completionRatePct);
      expect(top.quickSkipRatePct).toBeLessThan(bottom.quickSkipRatePct);

      // Verify calibration accuracy
      expect(satisfaction.predictedVsActualCalibration.meanAbsoluteErrorSec).toBeLessThan(2.0);
      expect(satisfaction.predictedVsActualCalibration.correlationCoefficient).toBeGreaterThan(0.9);
    });
  });
});
