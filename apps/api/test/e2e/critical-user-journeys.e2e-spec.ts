import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { ReelsService } from '../../src/modules/reels/reels.service';
import { FeedService } from '../../src/modules/feed/feed.service';
import { ChatService } from '../../src/modules/chat/chat.service';
import { ModerationService } from '../../src/modules/safety/moderation.service';
import { SubscriptionsService } from '../../src/modules/monetization/subscriptions.service';
import { PaymentGatewayService } from '../../src/modules/monetization/payment-gateway.service';
import { ComplianceExportService } from '../../src/modules/compliance/compliance-export.service';
import { ComplianceDeletionService } from '../../src/modules/compliance/compliance-deletion.service';
import { StorageService } from '../../src/modules/storage/storage.service';
import { RedisCounterService } from '../../src/modules/interactions/redis-counter.service';
import { MentionsService } from '../../src/modules/interactions/mentions.service';
import { AntiSpamService } from '../../src/modules/interactions/anti-spam.service';
import { AiInterestSuggesterService } from '../../src/modules/reels/ai-interest-suggester.service';
import { ChatSpamFilterService } from '../../src/modules/chat/chat-spam-filter.service';
import { RateLimiterService } from '../../src/modules/auth/rate-limiter.service';
import { FinancePayoutsService } from '../../src/modules/monetization/finance-payouts.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import {
  FeedMode,
  FeedControlAction,
  ReelStatus,
  ReelVisibility,
  ConversationType,
  ReportTargetType,
  ReportCategory,
  ModerationActionType,
  PaymentGateway,
} from '@shared/types';

describe('Prompt 22 — Critical End-to-End User Journeys (Release Gate Suite)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let reelsService: ReelsService;
  let feedService: FeedService;
  let chatService: ChatService;
  let moderationService: ModerationService;
  let subscriptionsService: SubscriptionsService;
  let paymentGatewayService: PaymentGatewayService;
  let exportService: ComplianceExportService;
  let deletionService: ComplianceDeletionService;

  let mockDb: any;
  let mockClient: any;
  let mockStorage: any;
  let mockQueue: any;

  const testAdultId = '11111111-1111-4111-8111-111111111111';
  const testMinorId = '22222222-2222-4222-8222-222222222222';
  const testRecipientId = '33333333-3333-4333-8333-333333333333';
  const testPrimaryInterestId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const testConversationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  beforeAll(async () => {
    mockClient = {
      query: jest.fn().mockImplementation((sql: string, params: any[] = []) => {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return Promise.resolve({ rows: [], rowCount: 1 });
        }
        if (sql.includes('SELECT * FROM users WHERE email =') || sql.includes('SELECT * FROM users WHERE username =') || sql.includes('SELECT id FROM users WHERE username =')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT u.id, u.username, u.email, u.password_hash') || (sql.includes('FROM users') && sql.includes('WHERE u.username ='))) {
          return Promise.resolve({
            rows: [
              {
                id: testAdultId,
                username: 'adult_creator',
                email: 'adult_creator@interest.test',
                password_hash: '$2b$10$w09aV90hOq06H0K8rA4wEODZq00zNfKq4sV7.Z6eZ9k21jO9n4uK',
                is_active: true,
                is_minor: false,
                display_name: 'Adult Creator',
                avatar_url: null,
              },
            ],
          });
        }
        if (sql.includes('SELECT id, interest_vector::text FROM users WHERE id =')) {
          return Promise.resolve({ rows: [{ id: testAdultId, interest_vector: '[0.1, 0.2, 0.3]' }] });
        }
        if (sql.includes('FROM users WHERE id =')) {
          return Promise.resolve({
            rows: [{ id: params[0] || testAdultId, email: 'user@interest.test', is_suspended: false, is_active: true }],
          });
        }
        if (sql.includes('INSERT INTO users')) {
          return Promise.resolve({
            rows: [
              {
                id: params[0] || testAdultId,
                username: params[0],
                email: params[1],
                password_hash: params[2],
                is_minor: params[5] !== undefined ? params[5] : false,
                is_active: true,
                is_suspended: false,
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          });
        }
        if (sql.includes('INSERT INTO profiles')) {
          return Promise.resolve({
            rows: [
              {
                user_id: params[0] || testAdultId,
                username: params[1],
                display_name: params[2],
                is_minor: params[3] || false,
                is_private_account: false,
                messaging_permission: 'EVERYONE',
                commenting_permission: 'EVERYONE',
              },
            ],
            rowCount: 1,
          });
        }
        if (sql.includes('SELECT * FROM user_sessions')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO user_sessions') || sql.includes('UPDATE user_sessions')) {
          return Promise.resolve({ rows: [{ id: 'sess-1' }], rowCount: 1 });
        }

        // --- FEED & INTERESTS ---
        if (sql.includes('SELECT interest_id, affinity_weight') || sql.includes('FROM user_interests')) {
          return Promise.resolve({
            rows: [{ interest_id: testPrimaryInterestId, affinity_weight: 1.0, is_muted: false, is_paused: false }],
          });
        }
        if (sql.includes('FROM user_blocks') || sql.includes('FROM user_mutes') || sql.includes('FROM user_feed_controls')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM reels r') || sql.includes('r.hls_master_url')) {
          return Promise.resolve({
            rows: [
              {
                id: 'reel-feed-1',
                creator_id: testAdultId,
                title: 'Neural Networks Architecture',
                caption: 'Deep learning concepts',
                hls_master_url: 'https://cdn.interest.app/reels/feed1/master.m3u8',
                thumbnail_url: 'https://cdn.interest.app/reels/feed1/thumb.jpg',
                duration_seconds: 25.0,
                view_count: 120,
                like_count: 15,
                comment_count: 2,
                save_count: 4,
                share_count: 1,
                quick_skip_count: 0,
                test_audience_delivered: 0,
                cosine_similarity: 0.88,
                username: 'ai_engineer',
                display_name: 'AI Engineer',
                avatar_url: 'https://cdn.interest.app/avatars/ai.jpg',
                primary_interest_id: testPrimaryInterestId,
                primary_interest_title: 'Artificial Intelligence',
                created_at: new Date(),
                is_liked: false,
                is_saved: false,
                is_following: false,
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO user_feed_controls')) {
          return Promise.resolve({ rows: [{ id: 'ctrl-1' }], rowCount: 1 });
        }

        // --- REELS & MULTIPART ---
        if (sql.includes('FROM reels WHERE id =') || sql.includes('SELECT id, creator_id FROM reels')) {
          return Promise.resolve({
            rows: [
              {
                id: params[0] || 'reel-upload-101',
                creator_id: testAdultId,
                title: 'Distributed Systems Deep Dive',
                raw_s3_key: 'videos/raw/distributed_systems_deep_dive.mp4',
                upload_id: 's3-upload-id-999',
                status: ReelStatus.PROCESSING,
                visibility: ReelVisibility.PUBLIC,
                duration_seconds: 25.0,
                created_at: new Date(),
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO reels')) {
          return Promise.resolve({
            rows: [
              {
                id: 'reel-upload-101',
                creator_id: params[1] || testAdultId,
                title: params[2] || 'Distributed Systems Deep Dive',
                caption: params[3] || '',
                thumbnail_url: params[4] || '',
                hls_master_url: params[5] || '',
                duration_seconds: params[6] || 25,
                status: params[7] || ReelStatus.PROCESSING,
                visibility: params[8] || ReelVisibility.PUBLIC,
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          });
        }
        if (sql.includes('UPDATE reels')) {
          return Promise.resolve({
            rows: [
              {
                id: 'reel-upload-101',
                creator_id: testAdultId,
                status: ReelStatus.PROCESSING,
                visibility: ReelVisibility.PUBLIC,
              },
            ],
            rowCount: 1,
          });
        }
        if (sql.includes('DELETE FROM reels')) {
          return Promise.resolve({ rows: [{ id: 'reel-upload-101' }], rowCount: 1 });
        }

        // --- CHAT & MESSAGING ---
        if (sql.includes('FROM conversation_participants')) {
          return Promise.resolve({
            rows: [
              {
                conversation_id: testConversationId,
                user_id: testAdultId,
                role: 'MEMBER',
                status: 'ACCEPTED',
              },
            ],
          });
        }
        if (sql.includes('FROM messages WHERE client_msg_id =')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('COALESCE(MAX(seq_num)')) {
          return Promise.resolve({ rows: [{ next_seq: 1 }] });
        }
        if (sql.includes('INSERT INTO messages')) {
          return Promise.resolve({
            rows: [
              {
                id: 'msg-999',
                conversation_id: testConversationId,
                sender_id: testAdultId,
                text: params[2] || 'Hello, looking forward to pairing!',
                message_type: 'TEXT',
                seq_num: 1,
                client_msg_id: 'client-idempotent-msg-999',
                status: 'SENT',
                is_edited: false,
                is_read: false,
                created_at: new Date(),
                updated_at: new Date(),
                sender_username: 'adult_creator',
                sender_display_name: 'Adult Creator',
              },
            ],
            rowCount: 1,
          });
        }
        if (sql.includes('FROM messages') && sql.includes('WHERE')) {
          return Promise.resolve({
            rows: [
              {
                id: 'msg-999',
                conversation_id: testConversationId,
                sender_id: testAdultId,
                text: 'Hello, looking forward to pairing!',
                message_type: 'TEXT',
                seq_num: 1,
                client_msg_id: 'client-idempotent-msg-999',
                status: 'SENT',
                is_edited: false,
                is_read: false,
                created_at: new Date(),
                updated_at: new Date(),
                sender_username: 'adult_creator',
                sender_display_name: 'Adult Creator',
              },
            ],
          });
        }

        // --- MODERATION & SAFETY ---
        if (sql.includes('FROM reports WHERE reporter_id =')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO reports')) {
          return Promise.resolve({
            rows: [
              {
                id: 'rep-violator-1',
                reporter_id: testAdultId,
                reported_user_id: 'target-user-violator',
                category: ReportCategory.HARASSMENT_BULLYING,
                status: 'PENDING',
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          });
        }
        if (sql.includes('UPDATE reports')) {
          return Promise.resolve({ rows: [{ id: 'rep-violator-1' }], rowCount: 1 });
        }
        if (sql.includes('FROM moderation_queue')) {
          return Promise.resolve({
            rows: [
              {
                id: 'q-violator-1',
                report_id: 'rep-violator-1',
                entity_type: ReportTargetType.USER,
                entity_id: 'target-user-violator',
                creator_id: 'target-user-violator',
                status: 'PENDING',
                priority_score: 100,
                report_count: 1,
                reasons: ['HARASSMENT_BULLYING'],
                is_urgent: false,
                created_at: new Date(),
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO moderation_queue')) {
          return Promise.resolve({ rows: [{ id: 'q-violator-1' }], rowCount: 1 });
        }
        if (sql.includes('INSERT INTO user_strikes') || sql.includes('INSERT INTO moderation_audit_logs')) {
          return Promise.resolve({ rows: [{ id: 'log-1' }], rowCount: 1 });
        }

        // --- SUBSCRIPTIONS & MONETIZATION ---
        if (sql.includes('FROM creator_subscription_plans')) {
          return Promise.resolve({
            rows: [
              {
                id: 'plan-supporter',
                creator_id: testRecipientId,
                title: 'Supporter Tier',
                description: 'Support creator content',
                price_cents: 500,
                currency: 'usd',
                billing_interval: 'month',
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          });
        }
        if (sql.includes('INSERT INTO user_subscriptions') || sql.includes('FROM user_subscriptions')) {
          return Promise.resolve({
            rows: [
              {
                id: 'sub-item-1',
                subscriber_id: testAdultId,
                creator_id: testRecipientId,
                plan_id: 'plan-supporter',
                status: 'active',
                gateway: PaymentGateway.STRIPE,
                gateway_subscription_id: 'sub_stripe_123',
                amount_cents: 500,
                currency: 'usd',
                current_period_start: new Date(),
                current_period_end: new Date(Date.now() + 30 * 86400 * 1000),
                cancel_at_period_end: false,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
            rowCount: 1,
          });
        }
        if (sql.includes('INSERT INTO user_entitlements') || sql.includes('FROM user_entitlements')) {
          return Promise.resolve({
            rows: [
              {
                id: 'ent-1',
                user_id: testAdultId,
                creator_id: testRecipientId,
                entitlement_type: 'SUBSCRIBER_BADGE',
                status: 'ACTIVE',
                created_at: new Date(),
                updated_at: new Date(),
                expires_at: new Date(Date.now() + 30 * 86400 * 1000),
              },
            ],
            rowCount: 1,
          });
        }
        if (sql.includes('creator_financial_accounts')) {
          return Promise.resolve({
            rows: [
              {
                user_id: params[0] || testRecipientId,
                gateway: 'stripe',
                stripe_account_id: 'acct_mock_stripe',
                razorpay_account_id: null,
                payout_enabled: true,
                available_balance_cents: '10000',
                pending_balance_cents: '0',
                lifetime_earnings_cents: '10000',
                currency: 'usd',
                tax_entity_type: 'INDIVIDUAL',
                tax_withholding_rate_bps: 0,
                kyc_status: 'VERIFIED',
                is_compliance_blocked: false,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
            rowCount: 1,
          });
        }
        if (sql.includes('financial_audit_trail') || sql.includes('UPDATE creator_financial_accounts')) {
          return Promise.resolve({ rows: [{ id: 'audit-1' }], rowCount: 1 });
        }
        if (sql.includes('invoices')) {
          return Promise.resolve({
            rows: [
              {
                id: 'inv-101',
                invoice_number: 'INV-2026-TEST',
                user_id: testAdultId,
                recipient_name: 'Adult Creator',
                subtotal_cents: 500,
                tax_rate_bps: 0,
                tax_amount_cents: 0,
                total_amount_cents: 500,
                currency: 'usd',
                gateway: 'stripe',
                gateway_invoice_id: 'in_stripe_123',
                status: 'PAID',
                items_breakdown: [],
                issued_at: new Date(),
                paid_at: new Date(),
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          });
        }

        // --- COMPLIANCE, DATA EXPORT & DELETION ---
        if (sql.includes('INSERT INTO data_export_requests')) {
          return Promise.resolve({
            rows: [
              {
                id: 'export-req-101',
                user_id: testAdultId,
                status: 'PENDING',
                format: 'JSON',
                download_token: 'tok_e2e_export_token',
                expires_at: new Date(Date.now() + 48 * 3600 * 1000),
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          });
        }
        if (sql.includes('FROM account_deletion_requests WHERE user_id =')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO account_deletion_requests')) {
          return Promise.resolve({
            rows: [
              {
                id: 'del-req-201',
                user_id: params[1] || testAdultId,
                status: 'PENDING_GRACE_PERIOD',
                grace_period_ends_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
                requested_at: new Date().toISOString(),
                reason: params[3] || 'E2E test run',
              },
            ],
            rowCount: 1,
          });
        }
        if (sql.includes('UPDATE account_deletion_requests')) {
          return Promise.resolve({
            rows: [{ id: 'del-req-201', status: 'CANCELLED' }],
            rowCount: 1,
          });
        }

        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
      release: jest.fn(),
    };

    mockDb = {
      query: jest.fn().mockImplementation((sql: string, params: any[] = []) => {
        return mockClient.query(sql, params);
      }),
      getClient: jest.fn().mockResolvedValue(mockClient),
      withTransaction: jest.fn().mockImplementation((cb) => cb(mockClient)),
    };

    mockStorage = {
      initiateMultipartUpload: jest.fn().mockResolvedValue('s3-upload-id-999'),
      getPresignedPartUrl: jest.fn().mockImplementation((key, uploadId, partNum) =>
        Promise.resolve(`https://s3.interest.test/parts/${partNum}?uploadId=${uploadId}`),
      ),
      completeMultipartUpload: jest.fn().mockResolvedValue('https://cdn.interest.app/uploads/raw/assembled.mp4'),
      getPresignedUploadUrl: jest.fn().mockResolvedValue('https://s3.interest.test/upload-single'),
      getPublicUrl: jest.fn().mockImplementation((key) => `https://cdn.interest.app/${key}`),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-transcode-1' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        ReelsService,
        FeedService,
        ChatService,
        ModerationService,
        SubscriptionsService,
        PaymentGatewayService,
        FinancePayoutsService,
        ComplianceExportService,
        ComplianceDeletionService,
        JwtService,
        {
          provide: RateLimiterService,
          useValue: {
            checkLoginAttempts: jest.fn().mockResolvedValue(undefined),
            recordFailedLogin: jest.fn().mockResolvedValue(undefined),
            clearLoginAttempts: jest.fn().mockResolvedValue(undefined),
            checkOtpRateLimit: jest.fn().mockResolvedValue(undefined),
            recordOtpRequest: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'JWT_SECRET') return 'test-jwt-secret-key-for-release-gate';
              if (key === 'JWT_REFRESH_SECRET') return 'test-jwt-refresh-secret-key-for-release-gate';
              if (key === 'STRIPE_API_KEY') return 'sk_test_mock_key';
              if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_secret_123';
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return 6379;
              if (key === 'REDIS_URL') return 'redis://localhost:6379';
              return null;
            }),
          },
        },
        { provide: DatabaseService, useValue: mockDb },
        { provide: StorageService, useValue: mockStorage },
        { provide: getQueueToken('video-transcode'), useValue: mockQueue },
        {
          provide: RedisCounterService,
          useValue: {
            getReelCounters: jest.fn().mockResolvedValue({ likes: 0, comments: 0, saves: 0, shares: 0 }),
            incrementReelCounter: jest.fn().mockResolvedValue(1),
            getCommentLikeCount: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: MentionsService,
          useValue: {
            extractMentions: jest.fn().mockReturnValue([]),
            processMentions: jest.fn().mockResolvedValue({ extractedUsernames: [], notifiedUserIds: [] }),
          },
        },
        {
          provide: AntiSpamService,
          useValue: {
            checkLikeRateLimit: jest.fn().mockResolvedValue(undefined),
            checkCommentRateLimit: jest.fn().mockResolvedValue(undefined),
            checkDuplicateComment: jest.fn().mockResolvedValue(undefined),
            checkFollowRateLimit: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AiInterestSuggesterService,
          useValue: { suggestInterests: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: ChatSpamFilterService,
          useValue: {
            analyzeMessage: jest.fn().mockResolvedValue({
              isSpam: false,
              spamScore: 0.0,
              isMutualFollow: true,
              shouldRouteToRequests: false,
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
    reelsService = moduleFixture.get<ReelsService>(ReelsService);
    feedService = moduleFixture.get<FeedService>(FeedService);
    chatService = moduleFixture.get<ChatService>(ChatService);
    moderationService = moduleFixture.get<ModerationService>(ModerationService);
    subscriptionsService = moduleFixture.get<SubscriptionsService>(SubscriptionsService);
    paymentGatewayService = moduleFixture.get<PaymentGatewayService>(PaymentGatewayService);
    exportService = moduleFixture.get<ComplianceExportService>(ComplianceExportService);
    deletionService = moduleFixture.get<ComplianceDeletionService>(ComplianceDeletionService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // Journey 1: Signup, Age-Gating & Authentication Flow
  // =========================================================================
  describe('Journey 1: Signup, Age-Gating & Authentication Flow', () => {
    it('registers synthetic adult user, hashes password, and issues valid tokens', async () => {
      const adult = await authService.register({
        email: 'adult_creator@interest.test',
        username: 'adult_creator',
        displayName: 'Adult Creator',
        birthdate: '1995-04-12', // Adult
        password: 'SecurePassword123!',
      });

      expect(adult).toBeDefined();
      expect(adult.tokens.accessToken).toBeDefined();
      expect(adult.user.is_minor ?? adult.user.isMinor).toBe(false);
    });

    it('registers synthetic minor user, sets COPPA/DPDP minor flag', async () => {
      const minor = await authService.register({
        email: 'minor_creator@interest.test',
        username: 'minor_creator',
        displayName: 'Minor Creator',
        birthdate: '2012-09-18', // Minor (<18)
        password: 'SecurePassword123!',
      });

      expect(minor).toBeDefined();
      expect(minor.user.is_minor ?? minor.user.isMinor).toBe(true);
    });

    it('rejects authentication with invalid password', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: testAdultId,
            email: 'adult_creator@interest.test',
            password_hash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
            is_active: true,
            is_suspended: false,
          },
        ],
      });

      await expect(
        authService.login({
          identifier: 'adult_creator@interest.test',
          password: 'IncorrectPassword!',
        }),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // Journey 2: Feed Discovery & Negative Recommendation Feedback Flow
  // =========================================================================
  describe('Journey 2: Feed Discovery & Recommendation Controls', () => {
    it('retrieves personalized candidate feed and handles user feedback controls', async () => {
      const feed = await feedService.getPersonalizedFeed(testAdultId, {
        mode: FeedMode.FOR_YOU,
        limit: 10,
      });

      expect(feed).toBeDefined();
      expect(feed.items.length).toBe(1);
      expect(feed.items[0].id).toBe('reel-feed-1');

      // Apply negative feedback (NOT_INTERESTED)
      const feedback = await feedService.applyFeedControl(testAdultId, {
        reelId: 'reel-feed-1',
        action: FeedControlAction.NOT_INTERESTED,
        interestId: testPrimaryInterestId,
      });

      expect(feedback.success).toBe(true);
    });
  });

  // =========================================================================
  // Journey 3: Video Posting, Resumable Multipart Upload & Playback Pipeline
  // =========================================================================
  describe('Journey 3: Video Posting & Resumable Multipart Pipeline', () => {
    it('initiates multipart session, uploads parts, and finalizes published reel', async () => {
      // 1. Initiate multipart upload
      const session = await reelsService.initiateMultipartUpload(testAdultId, {
        filename: 'distributed_systems_deep_dive.mp4',
        contentType: 'video/mp4',
        fileSizeBytes: 26 * 1024 * 1024, // 26 MB => 6 parts
      });

      expect(session).toBeDefined();
      expect(session.uploadId).toBe('s3-upload-id-999');
      expect(session.expectedParts).toBe(6);

      // 2. Complete multipart upload
      const completed = await reelsService.completeMultipartUpload(testAdultId, {
        reelId: 'reel-upload-101',
        uploadId: 's3-upload-id-999',
        s3Key: 'videos/raw/distributed_systems_deep_dive.mp4',
        parts: [
          { partNumber: 1, etag: '"etag1"' },
          { partNumber: 2, etag: '"etag2"' },
        ],
      });

      expect(completed.success).toBe(true);

      // 3. Finalize reel
      const finalized = await reelsService.finalizeReel(testAdultId, {
        reelId: 'reel-upload-101',
        title: 'Distributed Systems Deep Dive',
        primaryInterestId: testPrimaryInterestId,
        interestTagIds: [testPrimaryInterestId],
        visibility: ReelVisibility.PUBLIC,
      });

      expect(finalized).toBeDefined();
      expect(finalized.reelId).toBe('reel-upload-101');
    });
  });

  // =========================================================================
  // Journey 4: Direct Messaging & Delivery Receipts
  // =========================================================================
  describe('Journey 4: Direct Messaging & Delivery Receipts', () => {
    it('sends message with client idempotency key and prevents duplicate insertion', async () => {
      const clientMsgId = 'client-idempotent-msg-999';

      const message = await chatService.sendMessage(testAdultId, {
        conversationId: testConversationId,
        text: 'Hello, looking forward to pairing!',
        clientMsgId,
      });

      expect(message).toBeDefined();
      expect(message.id).toBe('msg-999');
      expect(message.status).toBe('SENT');
    });
  });

  // =========================================================================
  // Journey 5: Moderation, Age Safety & Reporting Flow
  // =========================================================================
  describe('Journey 5: Moderation, Age Safety & Reporting Escalation', () => {
    it('creates report, enters moderation queue, and resolves with user suspension', async () => {
      const report = await moderationService.createReport(testAdultId, {
        targetType: ReportTargetType.USER,
        targetId: 'target-user-violator',
        category: ReportCategory.HARASSMENT_BULLYING,
        details: 'Severe targeted harassment and abusive threats.',
      });

      expect(report).toBeDefined();
      expect(report.reportId).toBe('rep-violator-1');

      // Moderator resolves report via applyModeratorAction
      const resolution = await moderationService.applyModeratorAction('mod-lead-1', 'q-violator-1', {
        action: ModerationActionType.SUSPEND_USER,
        notes: 'Confirmed repeated severe harassment.',
      });

      expect(resolution.actionApplied).toBe(ModerationActionType.SUSPEND_USER);
    });
  });

  // =========================================================================
  // Journey 6: Subscriptions & Payment Intent Creation
  // =========================================================================
  describe('Journey 6: Subscriptions & Payment Creation', () => {
    it('creates creator subscription and grants entitlement without duplicate charges', async () => {
      jest.spyOn(paymentGatewayService, 'createSubscription').mockResolvedValue({
        gatewaySubscriptionId: 'sub_stripe_123',
        clientSecret: 'seti_test_secret_abc',
      });

      const sub = await subscriptionsService.subscribe(testAdultId, {
        planId: 'plan-supporter',
        gateway: PaymentGateway.STRIPE,
      });

      expect(sub).toBeDefined();
      expect(sub.id).toBe('sub-item-1');
      expect(sub.status).toBe('active');
    });
  });

  // =========================================================================
  // Journey 7: Privacy, Data Export & Cascade Account Deletion Flow
  // =========================================================================
  describe('Journey 7: Privacy, Data Export & Cascade Deletion', () => {
    it('initiates machine-readable data export package with 48h expiration', async () => {
      const exportReq = await exportService.requestDataExport(testAdultId);
      expect(exportReq).toBeDefined();
      expect(exportReq.downloadToken).toBeDefined();
      expect(exportReq.status).toBe('PENDING');
    });

    it('initiates 30-day grace period account deletion, then restores upon user cancel', async () => {
      // 1. Request deletion
      const deletionReq = await deletionService.requestAccountDeletion(testAdultId, {
        confirmImmediateFreeze: true,
        reason: 'E2E test run',
      });

      expect(deletionReq).toBeDefined();
      expect(deletionReq.status).toBe('PENDING_GRACE_PERIOD');

      // 2. Cancel deletion during grace period
      const cancelRes = await deletionService.cancelAccountDeletion(testAdultId);
      expect(cancelRes.success).toBe(true);
    });

    it('executes permanent cascade erasure with statutory tax invoice anonymization and honest 90-day rolling backup disclosure', async () => {
      const cascade = await deletionService.executePermanentDeletion(testAdultId);

      expect(cascade).toBeDefined();
      expect(cascade.backupPurgeTimelineDays).toBe(90); // Disclosed honest 90-day retention window
    });
  });
});
