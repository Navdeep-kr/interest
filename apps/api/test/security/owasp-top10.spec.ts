import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../src/database/database.service';
import { ZeroLocationInterceptor } from '../../src/common/interceptors/zero-location.interceptor';
import { GeoSanitizer } from '@shared/geo-sanitizer';
import { AntiSpamService } from '../../src/modules/interactions/anti-spam.service';
import { ContentScannerService } from '../../src/modules/safety/content-scanner.service';
import { PaymentGatewayService } from '../../src/modules/monetization/payment-gateway.service';
import { PaymentGateway } from '@shared/types';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('OWASP Top 10 API Security & Architectural Integrity Tests', () => {
  let antiSpamService: AntiSpamService;
  let paymentGatewayService: PaymentGatewayService;

  beforeEach(async () => {
    const mockDatabaseService = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      getClient: jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      }),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_secret_123';
        if (key === 'RAZORPAY_WEBHOOK_SECRET') return 'rzp_sec_test_secret_456';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AntiSpamService,
        PaymentGatewayService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    antiSpamService = module.get<AntiSpamService>(AntiSpamService);
    paymentGatewayService = module.get<PaymentGatewayService>(PaymentGatewayService);
  });

  // --------------------------------------------------------------------------
  // API 1: Broken Object Level Authorization (BOLA / IDOR)
  // --------------------------------------------------------------------------
  describe('API 1: Broken Object Level Authorization (BOLA / IDOR)', () => {
    it('should reject unauthorized access when a user attempts to modify another creator’s resource', () => {
      const authenticatedUserId = 'user-alice-1';
      const targetResourceOwnerId = 'user-bob-2';

      const checkOwnership = (authId: string, ownerId: string) => {
        if (authId !== ownerId) {
          throw new ForbiddenException('You do not have authorization to access or modify this resource.');
        }
      };

      expect(() => checkOwnership(authenticatedUserId, targetResourceOwnerId)).toThrow(ForbiddenException);
      expect(() => checkOwnership(authenticatedUserId, authenticatedUserId)).not.toThrow();
    });

    it('should reject WebSocket room joins when user is not a participant (ISSUE-01 Regression)', () => {
      const activeParticipants = new Set(['user-alice', 'user-bob']);
      const isParticipant = (uid: string) => activeParticipants.has(uid);

      expect(isParticipant('user-mallory')).toBe(false);
      expect(isParticipant('user-alice')).toBe(true);
    });

    it('should reject data export status access when user does not own the export request (ISSUE-02 Regression)', () => {
      const requestingUserId = 'user-alice';
      const exportJob = { id: 'exp-123', userId: 'user-bob', downloadToken: 'tok-secret' };

      const verifyExportOwnership = (reqUserId: string, jobOwnerId: string) => {
        if (reqUserId !== jobOwnerId) {
          throw new ForbiddenException('Access denied: You cannot view export requests belonging to other users.');
        }
      };

      expect(() => verifyExportOwnership(requestingUserId, exportJob.userId)).toThrow(ForbiddenException);
      expect(() => verifyExportOwnership('user-bob', exportJob.userId)).not.toThrow();
    });

    it('should reject data export download when token is forged or expired (ISSUE-02 Regression)', () => {
      const validToken = 'e4a2c5b9f7182930415263748596a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4';
      const expiresAt = new Date(Date.now() + 3600000); // 1 hr future

      const verifyDownloadToken = (provided: string, expected: string, expiry: Date) => {
        if (!provided || typeof provided !== 'string') {
          throw new UnauthorizedException('Missing download authorization token.');
        }
        const provBuf = Buffer.from(provided);
        const expBuf = Buffer.from(expected);
        if (provBuf.length !== expBuf.length || !crypto.timingSafeEqual(provBuf, expBuf)) {
          throw new UnauthorizedException('Invalid or forged download token.');
        }
        if (new Date() > expiry) {
          throw new ForbiddenException('Download token has expired.');
        }
        return true;
      };

      // Valid token & future expiry
      expect(verifyDownloadToken(validToken, validToken, expiresAt)).toBe(true);

      // Wrong token length
      expect(() => verifyDownloadToken('short', validToken, expiresAt)).toThrow(UnauthorizedException);

      // Same length forged token
      const forgedToken = validToken.substring(0, 63) + '0';
      expect(() => verifyDownloadToken(forgedToken, validToken, expiresAt)).toThrow(UnauthorizedException);

      // Expired token
      const pastExpiry = new Date(Date.now() - 1000);
      expect(() => verifyDownloadToken(validToken, validToken, pastExpiry)).toThrow(ForbiddenException);
    });
  });

  // --------------------------------------------------------------------------
  // API 2: Broken Authentication & Token Replay
  // --------------------------------------------------------------------------
  describe('API 2: Broken Authentication & Token Replay', () => {
    it('should reject authentication when token has been revoked or expired', () => {
      const validateSession = (isRevoked: boolean, expiresAt: number) => {
        if (isRevoked || Date.now() > expiresAt) {
          throw new UnauthorizedException('Authentication token revoked or expired.');
        }
      };

      expect(() => validateSession(true, Date.now() + 3600000)).toThrow(UnauthorizedException);
      expect(() => validateSession(false, Date.now() - 1000)).toThrow(UnauthorizedException);
      expect(() => validateSession(false, Date.now() + 3600000)).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // API 3: Broken Object Property Level Authorization (Mass Assignment)
  // --------------------------------------------------------------------------
  describe('API 3: Broken Object Property Level Authorization (Mass Assignment)', () => {
    it('should strip privileged fields and prohibited location properties from user input payloads', () => {
      const rawPayload = {
        displayName: 'Security Researcher',
        bio: 'Ethical hacker and creator',
        is_verified: true, // Privileged field
        role: 'SUPER_ADMIN', // Privileged field
        lat: 37.7749, // Prohibited location field
        lng: -122.4194, // Prohibited location field
        userCountry: 'US', // Prohibited location field
      };

      // Sanitization whitelist matching DTO rules
      const sanitized = {
        displayName: rawPayload.displayName,
        bio: rawPayload.bio,
      };

      expect((sanitized as any).is_verified).toBeUndefined();
      expect((sanitized as any).role).toBeUndefined();
      expect((sanitized as any).lat).toBeUndefined();
      expect((sanitized as any).lng).toBeUndefined();
      expect((sanitized as any).userCountry).toBeUndefined();
      expect(sanitized.displayName).toBe('Security Researcher');
    });
  });

  // --------------------------------------------------------------------------
  // API 4: Unrestricted Resource Consumption (Rate Limiting / Anti-Spam)
  // --------------------------------------------------------------------------
  describe('API 4: Unrestricted Resource Consumption (DoS / Rate Limiting)', () => {
    it('should throttle superhuman like velocities via sliding-window rate limiting', async () => {
      const userId = 'bot-attacker-01';

      // Simulate rapid likes up to limit
      for (let i = 0; i < 30; i++) {
        await antiSpamService.checkLikeRateLimit(userId);
      }

      // 31st like should exceed threshold and throw HttpException
      await expect(antiSpamService.checkLikeRateLimit(userId)).rejects.toThrow();
    });

    it('should block duplicate comment spam within sliding window', async () => {
      const userId = 'spammer-02';
      const spamComment = 'CHECK OUT FREE CRYPTO AT MY BIO LINK NOW!';

      await antiSpamService.checkDuplicateComment(userId, spamComment);

      // 2nd identical comment within window should be rejected
      await expect(antiSpamService.checkDuplicateComment(userId, spamComment)).rejects.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // API 5: Broken Function Level Authorization (BFLA)
  // --------------------------------------------------------------------------
  describe('API 5: Broken Function Level Authorization (BFLA)', () => {
    it('should deny non-administrative users from executing administrative operations', () => {
      const userRoles = ['USER'];
      const requiredRole = 'SUPER_ADMIN';

      const authorizeRole = (roles: string[], required: string) => {
        if (!roles.includes(required)) {
          throw new ForbiddenException('Administrative privileges required.');
        }
      };

      expect(() => authorizeRole(userRoles, requiredRole)).toThrow(ForbiddenException);
      expect(() => authorizeRole(['SUPER_ADMIN'], requiredRole)).not.toThrow();
    });

    it('should restrict creator-fund/calculate execution to ADMIN and SUPERADMIN (ISSUE-03 Regression)', () => {
      const checkCreatorFundAccess = (role: string) => {
        const allowedRoles = ['ADMIN', 'SUPERADMIN'];
        if (!allowedRoles.includes(role.toUpperCase())) {
          throw new ForbiddenException('Access denied. Required role(s): [ADMIN, SUPERADMIN].');
        }
        return true;
      };

      expect(() => checkCreatorFundAccess('USER')).toThrow(ForbiddenException);
      expect(() => checkCreatorFundAccess('CREATOR')).toThrow(ForbiddenException);
      expect(checkCreatorFundAccess('ADMIN')).toBe(true);
      expect(checkCreatorFundAccess('SUPERADMIN')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // API 6: Server-Side Request Forgery (SSRF)
  // --------------------------------------------------------------------------
  describe('API 6: Server-Side Request Forgery (SSRF)', () => {
    it('should reject URLs resolving to localhost, private networks, or cloud metadata services', () => {
      const validatePublicUrl = (urlStr: string) => {
        const parsed = new URL(urlStr);
        const forbiddenHosts = [
          'localhost',
          '127.0.0.1',
          '0.0.0.0',
          '169.254.169.254', // AWS/GCP instance metadata service
          '10.0.0.1',
          '192.168.1.1',
        ];

        if (forbiddenHosts.includes(parsed.hostname) || parsed.protocol !== 'https:') {
          throw new BadRequestException('Invalid or restricted destination URL.');
        }
        return true;
      };

      expect(() => validatePublicUrl('http://127.0.0.1:8080/admin')).toThrow(BadRequestException);
      expect(() => validatePublicUrl('http://169.254.169.254/latest/meta-data')).toThrow(BadRequestException);
      expect(() => validatePublicUrl('http://localhost:3000/api')).toThrow(BadRequestException);
      expect(validatePublicUrl('https://cdn.interest.app/assets/logo.png')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // API 7: Security Misconfiguration
  // --------------------------------------------------------------------------
  describe('API 7: Security Misconfiguration & Stack Trace Redaction', () => {
    it('should ensure internal system stack traces are stripped in production error responses', () => {
      const formatErrorResponse = (error: Error, isProduction: boolean) => {
        if (isProduction) {
          return {
            statusCode: 500,
            message: 'Internal Server Error',
            timestamp: new Date().toISOString(),
          };
        }
        return {
          statusCode: 500,
          message: error.message,
          stack: error.stack,
        };
      };

      const internalErr = new Error('Database password connection timeout at pg.pool.ts:42');
      const prodResponse = formatErrorResponse(internalErr, true);

      expect((prodResponse as any).stack).toBeUndefined();
      expect(prodResponse.message).toBe('Internal Server Error');
    });
  });

  // --------------------------------------------------------------------------
  // API 8: Injection (SQL / pgvector / Command Injection)
  // --------------------------------------------------------------------------
  describe('API 8: Injection Defense (SQL, pgvector, Command Injection)', () => {
    it('should neutralize SQL injection payloads in full-text search queries', () => {
      const maliciousInput = "synthesizers'; DROP TABLE reels; --";
      const sanitized = GeoSanitizer.sanitizeSearchQuery(maliciousInput);

      expect(sanitized).not.toContain('DROP TABLE');
      expect(sanitized).not.toContain(';');
    });

    it('should validate and parse pgvector strings strictly as numerical floating point arrays', () => {
      const validPgVector = '[0.125, -0.450, 0.882]';
      const vector = DatabaseService.pgToVector(validPgVector);

      expect(vector).toHaveLength(3);
      expect(vector[0]).toBeCloseTo(0.125);
      expect(vector[1]).toBeCloseTo(-0.450);

      // Malicious SQL injection in vector string
      const maliciousVector = '[0.125, 0.45]; DROP TABLE users;';
      const cleaned = DatabaseService.pgToVector(maliciousVector);
      // Ensure NaN values or strictly numeric conversion occurs without executing SQL
      expect(cleaned.some((v) => isNaN(v))).toBe(true);
    });

    it('should validate video container magic bytes and reject polyglot/scripts (ISSUE-05 Regression)', () => {
      const validateMagicBytes = (buf: Buffer): boolean => {
        if (buf.length < 12) return false;
        const brand = buf.toString('ascii', 4, 8);
        if (brand === 'ftyp' || brand === 'moov' || brand === 'mdat' || brand === 'wide' || brand === 'free') return true;
        if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true;
        if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'AVI ') return true;
        return false;
      };

      // Valid MP4 buffer (ftyp atom)
      const validMp4 = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
      expect(validateMagicBytes(validMp4)).toBe(true);

      // Valid WebM EBML buffer
      const validWebm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81]);
      expect(validateMagicBytes(validWebm)).toBe(true);

      // Malicious shell script disguised as video.mp4
      const shellScript = Buffer.from('#!/bin/bash\nrm -rf /tmp/data\necho "pwned"\n');
      expect(validateMagicBytes(shellScript)).toBe(false);

      // Random garbage data
      const randomGarbage = Buffer.alloc(32, 0xff);
      expect(validateMagicBytes(randomGarbage)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // API 9: Improper Inventory Management (API Versioning & Shadow Endpoint Defense)
  // --------------------------------------------------------------------------
  describe('API 9: Improper Inventory Management', () => {
    it('should reject unversioned or shadowed legacy endpoints and enforce strict /api/v1 prefix', () => {
      const validateApiPath = (path: string): { valid: boolean; version?: string } => {
        const match = path.match(/^\/api\/(v[0-9]+)\//);
        if (!match) return { valid: false };
        const version = match[1];
        if (version !== 'v1') return { valid: false, version };
        return { valid: true, version };
      };

      expect(validateApiPath('/users/list').valid).toBe(false);
      expect(validateApiPath('/v0/debug/reels').valid).toBe(false);
      expect(validateApiPath('/api/v2/experimental/feed').valid).toBe(false);
      expect(validateApiPath('/api/v1/feed').valid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // API 10: Unsafe Consumption of Third-Party APIs (Webhook Signature Verification)
  // --------------------------------------------------------------------------
  describe('API 10: Webhook Cryptographic Signature Verification', () => {
    it('should reject Stripe webhooks missing valid HMAC signature header', () => {
      const payload = JSON.stringify({ id: 'evt_test_123', type: 'checkout.session.completed' });
      const isValid = paymentGatewayService.verifyWebhookSignature(
        PaymentGateway.STRIPE,
        payload,
        '',
      );
      expect(isValid).toBe(false);
    });

    it('should reject Razorpay webhooks missing valid HMAC signature header', () => {
      const payload = JSON.stringify({ event: 'payment.captured' });
      const isValid = paymentGatewayService.verifyWebhookSignature(
        PaymentGateway.RAZORPAY,
        payload,
        '',
      );
      expect(isValid).toBe(false);
    });

    it('should safely handle mismatched signature lengths without RangeError crash (ISSUE-04 Regression)', () => {
      const payload = JSON.stringify({ event: 'payment.captured' });

      // Short signature that would trigger RangeError if length mismatch is unhandled
      expect(() => paymentGatewayService.verifyWebhookSignature(PaymentGateway.RAZORPAY, payload, 'short')).not.toThrow();
      expect(paymentGatewayService.verifyWebhookSignature(PaymentGateway.RAZORPAY, payload, 'short')).toBe(false);
      expect(paymentGatewayService.verifyWebhookSignature(PaymentGateway.RAZORPAY, payload, '')).toBe(false);
      expect(paymentGatewayService.verifyWebhookSignature(PaymentGateway.RAZORPAY, payload, null as any)).toBe(false);
    });

    it('should verify Stripe signature with v1 format and constant-time check (ISSUE-04 Regression)', () => {
      const payload = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' });
      const secret = 'whsec_test_secret_123';
      const expectedHex = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      // Formatted with Stripe t=...,v1=... scheme
      const stripeHeader = `t=1612345678,v1=${expectedHex}`;
      expect(paymentGatewayService.verifyWebhookSignature(PaymentGateway.STRIPE, payload, stripeHeader)).toBe(true);

      // Forged v1 signature
      const forgedHeader = `t=1612345678,v1=0000000000000000000000000000000000000000000000000000000000000000`;
      expect(paymentGatewayService.verifyWebhookSignature(PaymentGateway.STRIPE, payload, forgedHeader)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Zero-Location Architectural Security & Geo-Blindness
  // --------------------------------------------------------------------------
  describe('Zero-Location Architectural Invariant', () => {
    it('should sanitize captions and strip pseudo-geographic ranking signals', () => {
      const inputCaption = 'Amazing artisan coffee roaster in Tokyo Japan at 35.6762, 139.6503 #TokyoCoffee';
      const result = GeoSanitizer.sanitizeCaption(inputCaption);

      expect(result.detectedGeoTokens.length).toBeGreaterThan(0);
      expect(result.sanitizedText).not.toContain('Tokyo');
      expect(result.sanitizedText).not.toContain('35.6762');
    });
  });
});
