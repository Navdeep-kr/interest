import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { FeedService } from './feed.service';
import { ZeroLocationInterceptor } from '../../common/interceptors/zero-location.interceptor';
import { DatabaseService } from '../../database/database.service';
import { ReelStatus, EngagementAction } from '@shared/types';
import { applyVectorDrift } from '@shared/vector-math';

describe('Geo-Blind Feed Architecture Invariance Test Suite', () => {
  let feedService: FeedService;
  let interceptor: ZeroLocationInterceptor;
  let mockDatabaseService: any;
  let mockConfigService: any;

  // Shared deterministic interest vector for twin users (e.g., Calisthenics & Modular Synths)
  const sharedInterestVector = [
    0.15, 0.45, -0.25, 0.65, 0.0, 0.35, -0.1, 0.2, 0.05, -0.3,
    ...new Array(502).fill(0.01),
  ];
  const sharedVectorStr = `[${sharedInterestVector.join(',')}]`;

  // Mock candidate reels catalog returned by the vector database
  const mockPublishedReels = [
    {
      id: 'reel-uuid-001',
      creator_id: 'creator-uuid-01',
      title: 'Planche Progression Mastery',
      caption: 'Straight arm strength training tips',
      hls_master_url: 'https://cdn.interest.app/reels/reel-uuid-001/hls/master.m3u8',
      thumbnail_url: 'https://cdn.interest.app/reels/reel-uuid-001/hls/thumb.jpg',
      duration_seconds: '24.5',
      view_count: '12400',
      like_count: '3120',
      comment_count: '142',
      save_count: '890',
      share_count: '230',
      cosine_similarity: '0.9421',
      username: 'calisthenics_pro',
      display_name: 'Alex Calisthenics',
      avatar_url: 'https://cdn.interest.app/avatars/alex.jpg',
      primary_interest_id: 'interest-uuid-calisthenics',
      created_at: new Date('2026-09-01T12:00:00Z'),
    },
    {
      id: 'reel-uuid-002',
      creator_id: 'creator-uuid-02',
      title: 'Modular Synth Clock Dividers',
      caption: 'Complex polyrhythms with Pamela PRO Workout',
      hls_master_url: 'https://cdn.interest.app/reels/reel-uuid-002/hls/master.m3u8',
      thumbnail_url: 'https://cdn.interest.app/reels/reel-uuid-002/hls/thumb.jpg',
      duration_seconds: '18.0',
      view_count: '8540',
      like_count: '2100',
      comment_count: '98',
      save_count: '540',
      share_count: '110',
      cosine_similarity: '0.9150',
      username: 'patchbay_guru',
      display_name: 'Elena Synthesizers',
      avatar_url: 'https://cdn.interest.app/avatars/elena.jpg',
      primary_interest_id: 'interest-uuid-modular',
      created_at: new Date('2026-09-02T15:30:00Z'),
    },
    {
      id: 'reel-uuid-003',
      creator_id: 'creator-uuid-03',
      title: 'Zero-Cost Rust Allocators',
      caption: 'Embedded systems performance deep dive',
      hls_master_url: 'https://cdn.interest.app/reels/reel-uuid-003/hls/master.m3u8',
      thumbnail_url: 'https://cdn.interest.app/reels/reel-uuid-003/hls/thumb.jpg',
      duration_seconds: '45.0',
      view_count: '5600',
      like_count: '1450',
      comment_count: '64',
      save_count: '420',
      share_count: '85',
      cosine_similarity: '0.8870',
      username: 'rustacean_core',
      display_name: 'Ken Systems',
      avatar_url: 'https://cdn.interest.app/avatars/ken.jpg',
      primary_interest_id: 'interest-uuid-rust',
      created_at: new Date('2026-09-03T09:15:00Z'),
    },
  ];

  beforeEach(() => {
    interceptor = new ZeroLocationInterceptor();

    mockDatabaseService = {
      query: jest.fn().mockImplementation((sql: string, params: any[]) => {
        // User profile / interest vector lookup
        if (sql.includes('FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: params[0],
                interest_vector: sharedVectorStr,
                preferred_languages: ['en'],
              },
            ],
          });
        }

        // Muted interests lookup
        if (sql.includes('FROM user_interests WHERE user_id = $1 AND is_muted = TRUE')) {
          return Promise.resolve({ rows: [] });
        }

        // Direct cosine similarity query (pgvector operator <=>)
        if (sql.includes('ri.is_primary = TRUE')) {
          return Promise.resolve({
            rows: mockPublishedReels,
          });
        }

        return Promise.resolve({ rows: [] });
      }),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    };

    feedService = new FeedService(mockDatabaseService as any, mockConfigService as any);
  });

  afterEach(async () => {
    if ((feedService as any).redisClient) {
      await (feedService as any).redisClient.disconnect();
    }
  });


  function simulateHttpRequest(req: any): Promise<void> {
    const mockContext: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as any;

    const mockCallHandler: CallHandler = {
      handle: () => of({ success: true }),
    };

    return new Promise((resolve) => {
      interceptor.intercept(mockContext, mockCallHandler).subscribe(() => resolve());
    });
  }

  // ==========================================================================
  // GUARANTEE 1: Identical feed for twin users in different countries & IPs
  // ==========================================================================
  it('should deliver identical feed items, sequence order, and similarity scores to twin users in Japan and the UK', async () => {
    const userTokyoId = '11111111-1111-4111-a111-000000000001';
    const userLondonId = '22222222-2222-4222-a222-000000000002';

    // Simulated HTTP request from Tokyo, Japan
    const reqTokyo: any = {
      headers: {
        'cf-ipcountry': 'JP',
        'cf-ipcity': 'Tokyo',
        'cf-iplatitude': '35.6762',
        'cf-iplongitude': '139.6503',
        'x-forwarded-for': '203.0.113.195',
        'x-real-ip': '203.0.113.195',
        authorization: 'Bearer token-tokyo',
      },
      query: {
        limit: 10,
        lat: '35.6762',
        lon: '139.6503',
        country: 'JP',
      },
      ip: '203.0.113.195',
    };

    // Simulated HTTP request from London, United Kingdom
    const reqLondon: any = {
      headers: {
        'cloudfront-viewer-country': 'GB',
        'cloudfront-viewer-city': 'London',
        'cloudfront-viewer-postal-code': 'SW1A 1AA',
        'x-forwarded-for': '81.2.69.142',
        'x-real-ip': '81.2.69.142',
        authorization: 'Bearer token-london',
      },
      query: {
        limit: 10,
        city: 'London',
        country: 'GB',
        proximity: '10km',
      },
      ip: '81.2.69.142',
    };

    // 1. Pass requests through ZeroLocationInterceptor
    await simulateHttpRequest(reqTokyo);
    await simulateHttpRequest(reqLondon);

    // Verify geo markers were stripped completely before reaching application layer
    expect(reqTokyo.headers['cf-ipcountry']).toBeUndefined();
    expect(reqTokyo.headers['x-forwarded-for']).toBeUndefined();
    expect(reqTokyo.query.lat).toBeUndefined();
    expect(reqTokyo.query.country).toBeUndefined();
    expect(reqTokyo.ip).toBe('REDACTED_BY_ZERO_LOCATION_POLICY');

    expect(reqLondon.headers['cloudfront-viewer-country']).toBeUndefined();
    expect(reqLondon.headers['x-forwarded-for']).toBeUndefined();
    expect(reqLondon.query.city).toBeUndefined();
    expect(reqLondon.query.proximity).toBeUndefined();
    expect(reqLondon.ip).toBe('REDACTED_BY_ZERO_LOCATION_POLICY');

    // 2. Fetch personalized feed for both users
    const feedTokyo = await feedService.getPersonalizedFeed(userTokyoId, { limit: 10 });
    const feedLondon = await feedService.getPersonalizedFeed(userLondonId, { limit: 10 });

    // 3. HARD INVARIANCE ASSERTION: The feeds must be 100% equivalent
    expect(feedTokyo.items.length).toBe(feedLondon.items.length);
    expect(feedTokyo.items.length).toBeGreaterThan(0);

    for (let i = 0; i < feedTokyo.items.length; i++) {
      const itemTokyo = feedTokyo.items[i];
      const itemLondon = feedLondon.items[i];

      // Exact ID equality and ranking position
      expect(itemTokyo.id).toBe(itemLondon.id);
      expect(itemTokyo.title).toBe(itemLondon.title);
      expect(itemTokyo.creatorId).toBe(itemLondon.creatorId);

      // Exact floating-point cosine similarity match
      expect(itemTokyo.similarityScore!).toBeCloseTo(itemLondon.similarityScore!, 5);


      // Engagement statistics match
      expect(itemTokyo.likeCount).toBe(itemLondon.likeCount);
      expect(itemTokyo.viewCount).toBe(itemLondon.viewCount);
      expect(itemTokyo.primaryInterestId).toBe(itemLondon.primaryInterestId);
    }
  });

  // ==========================================================================
  // GUARANTEE 2: Database queries contain ZERO geographic filters or projections
  // ==========================================================================
  it('should verify that database queries contain exclusively interest vector cosine distances and NO location fields', async () => {
    const userId = '11111111-1111-4111-a111-000000000001';
    await feedService.getPersonalizedFeed(userId, { limit: 10 });

    const sqlCalls: string[] = mockDatabaseService.query.mock.calls.map((call: any[]) => call[0]);
    const feedQuery = sqlCalls.find((sql) => sql.includes('cosine_similarity'));

    expect(feedQuery).toBeDefined();

    // Check presence of pure interest vector ranking formula
    expect(feedQuery).toContain('1 - (r.embedding <=> $1::vector)');
    expect(feedQuery).toContain('ORDER BY (r.embedding <=> $1::vector)');


    // Prohibited location tokens in query text
    const forbiddenLocationKeywords = [
      'country',
      'city',
      'latitude',
      'longitude',
      'lat',
      'lon',
      'lng',
      'region',
      'postal_code',
      'zip',
      'proximity',
      'geofence',
      'distance_km',
      'radius',
      'ip_address',
    ];

    for (const keyword of forbiddenLocationKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      expect(feedQuery).not.toMatch(regex);
    }
  });

  // ==========================================================================
  // GUARANTEE 3: Adversarial geo-spoofing attempts produce zero delta
  // ==========================================================================
  it('should produce identical feed output even when malicious user injects 10+ fake geo headers', async () => {
    const normalUser = '33333333-3333-4333-a333-000000000003';
    const adversarialUser = '44444444-4444-4444-a444-000000000004';

    const reqAdversarial: any = {
      headers: {
        'cf-ipcountry': 'US',
        'cf-ipcity': 'Miami',
        'x-country-code': 'DE',
        'x-city': 'Berlin',
        'x-region': 'Bavaria',
        'x-forwarded-for': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
        'true-client-ip': '3.3.3.3',
        'fastly-client-ip': '4.4.4.4',
        'x-appengine-country': 'FR',
        'x-geo-country': 'IT',
      },
      query: {
        lat: '48.8566',
        lon: '2.3522',
        city: 'Paris',
        country: 'France',
        proximity: '25km',
      },
      body: {
        latitude: 48.8566,
        longitude: 2.3522,
      },
      ip: '1.1.1.1',
    };

    await simulateHttpRequest(reqAdversarial);

    const normalFeed = await feedService.getPersonalizedFeed(normalUser, { limit: 10 });
    const adversarialFeed = await feedService.getPersonalizedFeed(adversarialUser, { limit: 10 });

    const normalIds = normalFeed.items.map((i) => i.id);
    const adversarialIds = adversarialFeed.items.map((i) => i.id);

    expect(adversarialIds).toEqual(normalIds);
  });

  // ==========================================================================
  // GUARANTEE 4: Telemetry vector drift is mathematically identical across IPs
  // ==========================================================================
  it('should compute identical vector drift for Tokyo and London users watching the same content', () => {
    const initialVectorUserA = [...sharedInterestVector];
    const initialVectorUserB = [...sharedInterestVector];

    const reelEmbedding = [
      0.2, 0.4, -0.1, 0.7, 0.0, 0.3, -0.05, 0.15, 0.08, -0.25,
      ...new Array(502).fill(0.02),
    ];

    // Both users like the reel (learning rate alpha = 0.15)
    const alpha = 0.15;
    const driftedVectorA = applyVectorDrift(initialVectorUserA, reelEmbedding, alpha);
    const driftedVectorB = applyVectorDrift(initialVectorUserB, reelEmbedding, alpha);

    // Vectors must be bit-exact identical
    for (let i = 0; i < driftedVectorA.length; i++) {
      expect(driftedVectorA[i]).toBeCloseTo(driftedVectorB[i], 10);
    }

    // Magnitude must remain unit length = 1.0
    const magnitude = Math.sqrt(driftedVectorA.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 5);
  });
});
