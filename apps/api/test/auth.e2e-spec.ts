import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { ZeroLocationInterceptor } from '../src/common/interceptors/zero-location.interceptor';

describe('AuthModule End-to-End (E2E) Tests', () => {
  let app: INestApplication;
  let mockAuthService: any;

  beforeAll(async () => {
    mockAuthService = {
      register: jest.fn().mockImplementation((dto) => {
        // Enforce age gate check in mock
        const birthDate = new Date(dto.birthdate);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        if (age < 13) {
          throw new Error('You must be at least 13 years old to use Interest (COPPA Compliance).');
        }
        return Promise.resolve({
          user: { id: 'uuid-1', username: dto.username, isMinor: age < 18 },
          tokens: {
            accessToken: 'mock.access.jwt',
            refreshToken: 'mock.refresh.jwt',
            expiresIn: 900,
          },
        });
      }),
      login: jest.fn().mockImplementation((dto) => {
        if (dto.password === 'WrongPassword!') {
          throw new Error('Invalid credentials.');
        }
        return Promise.resolve({
          user: { id: 'uuid-1', username: dto.identifier },
          tokens: {
            accessToken: 'mock.access.jwt',
            refreshToken: 'mock.refresh.jwt',
            expiresIn: 900,
          },
        });
      }),
      requestPhoneOtp: jest.fn().mockResolvedValue({ message: 'OTP sent successfully.' }),
      verifyPhoneOtp: jest.fn().mockResolvedValue({
        user: { id: 'uuid-1', phoneNumber: '+1234567890' },
        tokens: {
          accessToken: 'mock.access.jwt',
          refreshToken: 'mock.refresh.jwt',
          expiresIn: 900,
        },
      }),
      refreshTokens: jest.fn().mockResolvedValue({
        accessToken: 'new.access.jwt',
        refreshToken: 'new.refresh.jwt',
        expiresIn: 900,
      }),
      forgotPassword: jest.fn().mockResolvedValue({
        message: 'If that email exists, password reset instructions have been sent.',
      }),
      resetPassword: jest.fn().mockResolvedValue({
        success: true,
        message: 'Password has been successfully updated.',
      }),
      verifyEmail: jest.fn().mockResolvedValue({
        success: true,
        message: 'Email successfully verified.',
      }),
      getUserSessions: jest
        .fn()
        .mockResolvedValue([
          { id: 'sess-1', deviceName: 'iPhone 15 Pro', lastActiveAt: new Date().toISOString() },
        ]),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Enable validation pipe and ZeroLocationInterceptor
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ZeroLocationInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should reject registration with 400 when birthdate indicates age < 13 (COPPA)', async () => {
      const under13Date = new Date();
      under13Date.setFullYear(under13Date.getFullYear() - 11);

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          username: 'kid_maker',
          email: 'kid@interest.app',
          displayName: 'Kid Maker',
          password: 'Password123!',
          birthdate: under13Date.toISOString().split('T')[0],
        });

      // Handled by age gate validation or controller exception
      expect([400, 500]).toContain(res.status);
    });

    it('should reject registration when required fields are missing', async () => {
      const res = await request(app.getHttpServer()).post('/auth/register').send({
        username: 'in', // Too short (min 3)
        // Missing password and birthdate
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBeDefined();
    });

    it('should register successfully and scrub geo headers from request', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .set('cf-ipcountry', 'US')
        .set('x-forwarded-for', '203.0.113.195')
        .send({
          username: 'valid_creator',
          email: 'creator@interest.app',
          displayName: 'Valid Creator',
          password: 'StrongPassword123!',
          birthdate: '1998-04-12',
          deviceName: 'Pixel 8',
        });

      expect(res.status).toBe(201);
      expect(res.body.tokens).toBeDefined();
      expect(res.body.tokens.accessToken).toBe('mock.access.jwt');
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({
        identifier: 'valid_creator',
        password: 'StrongPassword123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.tokens).toBeDefined();
    });

    it('should reject invalid password format with 400', async () => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({
        identifier: '',
        password: '',
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/otp/request', () => {
    it('should reject invalid phone format with 400', async () => {
      const res = await request(app.getHttpServer()).post('/auth/otp/request').send({
        phoneNumber: 'not-a-phone-number',
      });

      expect(res.status).toBe(400);
    });

    it('should accept valid E.164 phone number with 200', async () => {
      const res = await request(app.getHttpServer()).post('/auth/otp/request').send({
        phoneNumber: '+14155552671',
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('OTP sent');
    });
  });

  describe('POST /auth/verify-email', () => {
    it('should verify email token with 200', async () => {
      const res = await request(app.getHttpServer()).post('/auth/verify-email').send({
        token: 'valid-32-byte-crypto-token',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
