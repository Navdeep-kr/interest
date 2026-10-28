import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { APP_INTERCEPTOR, APP_GUARD, APP_FILTER } from '@nestjs/core';

import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { InterestsModule } from './modules/interests/interests.module';
import { StorageModule } from './modules/storage/storage.module';
import { TranscodeModule } from './modules/transcode/transcode.module';
import { ReelsModule } from './modules/reels/reels.module';
import { FeedModule } from './modules/feed/feed.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { InteractionsModule } from './modules/interactions/interactions.module';
import { CreatorModule } from './modules/creator/creator.module';
import { SearchModule } from './modules/search/search.module';
import { ChatModule } from './modules/chat/chat.module';
import { SafetyModule } from './modules/safety/safety.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MonetizationModule } from './modules/monetization/monetization.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ExperimentsModule } from './modules/experiments/experiments.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { SocialImporterModule } from './modules/social-importer/social-importer.module';
import { ProfileModule } from './modules/profile/profile.module';
import { StoriesModule } from './modules/stories/stories.module';
import { CommunitiesModule } from './modules/communities/communities.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { LearnModule } from './modules/learn/learn.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { LiveModule } from './modules/live/live.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';

import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ZeroLocationInterceptor } from './common/interceptors/zero-location.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379');
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname || 'localhost',
            port: parseInt(url.port || '6379', 10),
            password: url.password || undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    InterestsModule,
    StorageModule,
    TranscodeModule,
    ReelsModule,
    FeedModule,
    TelemetryModule,
    InteractionsModule,
    CreatorModule,
    SearchModule,
    ChatModule,
    SafetyModule,
    NotificationsModule,
    MonetizationModule,
    AnalyticsModule,
    ExperimentsModule,
    ComplianceModule,
    SocialImporterModule,
    ProfileModule,
    StoriesModule,
    CommunitiesModule,
    MetricsModule,
    LearnModule,
    AiAssistantModule,
    LiveModule,
    MarketplaceModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter, // Global consistent error response & redaction
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZeroLocationInterceptor, // Immutable zero-location guarantee
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor, // Structured request/response logging
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor, // 30s timeout defense
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor, // Financial & mutating deduplication
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Global JWT protection with @Public() override
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // RBAC authorization
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard, // Sliding window abuse & rate limiting
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

