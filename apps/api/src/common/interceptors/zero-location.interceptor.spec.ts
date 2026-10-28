import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ZeroLocationInterceptor } from './zero-location.interceptor';

describe('ZeroLocationInterceptor', () => {
  let interceptor: ZeroLocationInterceptor;

  beforeEach(() => {
    interceptor = new ZeroLocationInterceptor();
  });

  it('should strip geolocation and IP proxy headers completely', (done) => {
    const mockRequest: any = {
      headers: {
        'cf-ipcountry': 'US',
        'cf-ipcity': 'San Francisco',
        'cf-iplatitude': '37.7749',
        'cf-iplongitude': '-122.4194',
        'cloudfront-viewer-country': 'US',
        'cloudfront-viewer-city': 'San Francisco',
        'cloudfront-viewer-postal-code': '94103',
        'fastly-client-ip': '203.0.113.195',
        'x-appengine-country': 'US',
        'x-forwarded-for': '203.0.113.195',
        'x-real-ip': '203.0.113.195',
        authorization: 'Bearer valid-token',
        'content-type': 'application/json',
      },
      query: {
        lat: '37.77',
        lon: '-122.41',
        country: 'US',
        city: 'SF',
        proximity: '5km',
        category: 'modular-synths',
      },
      body: {
        title: 'Eurorack Patching',
        country: 'US',
        city: 'SF',
      },
      ip: '203.0.113.195',
    };

    const mockContext: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as any;

    const mockCallHandler: CallHandler = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe(() => {
      // Cloudflare geo headers must be deleted
      expect(mockRequest.headers['cf-ipcountry']).toBeUndefined();
      expect(mockRequest.headers['cf-ipcity']).toBeUndefined();
      expect(mockRequest.headers['cf-iplatitude']).toBeUndefined();
      expect(mockRequest.headers['cf-iplongitude']).toBeUndefined();

      // CloudFront & Fastly headers must be deleted
      expect(mockRequest.headers['cloudfront-viewer-country']).toBeUndefined();
      expect(mockRequest.headers['cloudfront-viewer-city']).toBeUndefined();
      expect(mockRequest.headers['cloudfront-viewer-postal-code']).toBeUndefined();
      expect(mockRequest.headers['fastly-client-ip']).toBeUndefined();
      expect(mockRequest.headers['x-appengine-country']).toBeUndefined();
      expect(mockRequest.headers['x-forwarded-for']).toBeUndefined();
      expect(mockRequest.headers['x-real-ip']).toBeUndefined();

      // Normal headers must be preserved
      expect(mockRequest.headers['authorization']).toBe('Bearer valid-token');

      // IP must be redacted
      expect(mockRequest.ip).toBe('REDACTED_BY_ZERO_LOCATION_POLICY');

      // Geo query parameters must be stripped
      expect(mockRequest.query.lat).toBeUndefined();
      expect(mockRequest.query.lon).toBeUndefined();
      expect(mockRequest.query.country).toBeUndefined();
      expect(mockRequest.query.city).toBeUndefined();
      expect(mockRequest.query.proximity).toBeUndefined();
      expect(mockRequest.query.category).toBe('modular-synths');

      // Body geo pollution must be stripped
      expect(mockRequest.body.country).toBeUndefined();
      expect(mockRequest.body.city).toBeUndefined();
      expect(mockRequest.body.title).toBe('Eurorack Patching');

      done();
    });
  });
});

