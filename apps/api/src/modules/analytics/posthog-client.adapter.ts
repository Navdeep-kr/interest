import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PostHogEventPayload {
  event: string;
  distinctId: string;
  properties: Record<string, any>;
  timestamp?: string;
}

@Injectable()
export class PostHogClientAdapter {
  private readonly logger = new Logger(PostHogClientAdapter.name);
  private readonly apiKey: string;
  private readonly host: string;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('POSTHOG_API_KEY', '');
    this.host = this.configService.get<string>('POSTHOG_HOST', 'https://us.i.posthog.com');
    this.isEnabled = !!this.apiKey;

    if (this.isEnabled) {
      this.logger.log(`PostHog client initialized targeting ${this.host} with zero-location mode.`);
    } else {
      this.logger.log('PostHog API key not configured; operating in local analytical ingestion mode.');
    }
  }

  /**
   * Sanitizes properties to strictly preserve zero-location architectural compliance:
   * 1. Forces $geoip_disable = true to stop PostHog cloud from resolving IP addresses.
   * 2. Overwrites any $ip property with null.
   * 3. Strips any extraneous geographical properties.
   */
  private sanitizeProperties(props: Record<string, any> = {}): Record<string, any> {
    const sanitized = { ...props };

    // PostHog GeoIP disabling flags
    sanitized['$geoip_disable'] = true;
    sanitized['$ip'] = null;

    // Remove any forbidden keys if erroneously provided by client payload
    const forbiddenKeys = [
      'ip',
      'client_ip',
      'device_ip',
      'remote_addr',
      'lat',
      'lng',
      'city',
      'region',
      'postal_code',
      'timezone_city',
    ];

    for (const key of forbiddenKeys) {
      if (key in sanitized) {
        delete sanitized[key];
      }
    }

    return sanitized;
  }

  /**
   * Sends a single event to PostHog ingestion endpoint
   */
  async capture(event: PostHogEventPayload): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.debug(
        `[Local PostHog Mock] Capture: ${event.event} for distinctId=${event.distinctId}`,
      );
      return true;
    }

    const payload = {
      api_key: this.apiKey,
      event: event.event,
      distinct_id: event.distinctId,
      properties: this.sanitizeProperties(event.properties),
      timestamp: event.timestamp || new Date().toISOString(),
    };

    try {
      const response = await fetch(`${this.host}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(`PostHog capture returned status ${response.status}`);
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`PostHog capture request failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Sends a batch of events to PostHog /batch/ endpoint
   */
  async captureBatch(events: PostHogEventPayload[]): Promise<boolean> {
    if (events.length === 0) return true;

    if (!this.isEnabled) {
      this.logger.debug(`[Local PostHog Mock] Batch capture: ${events.length} events processed.`);
      return true;
    }

    const batch = events.map((ev) => ({
      event: ev.event,
      distinct_id: ev.distinctId,
      properties: this.sanitizeProperties(ev.properties),
      timestamp: ev.timestamp || new Date().toISOString(),
    }));

    try {
      const response = await fetch(`${this.host}/batch/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          batch,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`PostHog batch returned status ${response.status}`);
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`PostHog batch request failed: ${err.message}`);
      return false;
    }
  }
}
