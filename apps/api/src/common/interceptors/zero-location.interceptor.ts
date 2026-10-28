import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger, Optional } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { MetricsService } from '../../modules/metrics/metrics.service';

/**
 * ZeroLocationInterceptor
 * Enforces the core architectural principle:
 * Location (GPS, IP, country, city, coordinates) must NEVER be collected,
 * inferred, or passed to any application service or recommendation pipeline.
 */
@Injectable()
export class ZeroLocationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ZeroLocationInterceptor.name);

  constructor(@Optional() private readonly metricsService?: MetricsService) {}

  // Headers that proxies, CDNs, and cloud gateways attach containing geographic hints
  private readonly GEO_HEADERS_TO_STRIP = [
    // Cloudflare
    'cf-ipcountry',
    'cf-ipcity',
    'cf-iplatitude',
    'cf-iplongitude',
    'cf-region',
    'cf-postal-code',
    // AWS CloudFront
    'cloudfront-viewer-country',
    'cloudfront-viewer-country-name',
    'cloudfront-viewer-city',
    'cloudfront-viewer-postal-code',
    'cloudfront-viewer-latitude',
    'cloudfront-viewer-longitude',
    'cloudfront-viewer-time-zone',
    // Fastly & Akamai
    'fastly-client-ip',
    'x-client-ip',
    'true-client-ip',
    // Google Cloud / App Engine
    'x-appengine-country',
    'x-appengine-region',
    'x-appengine-city',
    'x-appengine-citylatlong',
    // Generic proxy & GeoIP headers
    'x-country-code',
    'x-country',
    'x-city',
    'x-region',
    'x-forwarded-for',
    'x-real-ip',
    'geoip-country-code',
    'x-geo-country',
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request && request.headers) {
      // 1. Strip all incoming geolocation / IP headers from downstream access
      for (const header of this.GEO_HEADERS_TO_STRIP) {
        if (request.headers[header]) {
          delete request.headers[header];
        }
      }

      // 2. Redact IP address on the request object so controllers cannot read it
      Object.defineProperty(request, 'ip', {
        value: 'REDACTED_BY_ZERO_LOCATION_POLICY',
        writable: false,
      });

      // 3. Prevent query parameter pollution with geo fields
      if (request.query) {
        delete (request.query as any).lat;
        delete (request.query as any).lon;
        delete (request.query as any).latitude;
        delete (request.query as any).longitude;
        delete (request.query as any).country;
        delete (request.query as any).city;
        delete (request.query as any).region;
        delete (request.query as any).postal_code;
        delete (request.query as any).zip;
        delete (request.query as any).radius;
        delete (request.query as any).proximity;
      }

      // 4. Prevent payload body pollution with geo fields
      if (request.body && typeof request.body === 'object') {
        delete (request.body as any).lat;
        delete (request.body as any).lon;
        delete (request.body as any).latitude;
        delete (request.body as any).longitude;
        delete (request.body as any).country;
        delete (request.body as any).city;
      }
    }

    return next.handle();
  }

}
