import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  Matches,
  IsUUID,
} from 'class-validator';
import {
  NotificationType,
  NotificationPriority,
  DevicePlatform,
} from '@shared/types';

export class RegisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  deviceName?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  pushProvider?: string;
}

export class UnregisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class UpdateNotificationPreferencesDto {
  // In-App
  @IsOptional()
  @IsBoolean()
  inAppLikes?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppComments?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppMentions?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppFollows?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppDms?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppInterests?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppMilestones?: boolean;

  // Push
  @IsOptional()
  @IsBoolean()
  pushLikes?: boolean;

  @IsOptional()
  @IsBoolean()
  pushComments?: boolean;

  @IsOptional()
  @IsBoolean()
  pushMentions?: boolean;

  @IsOptional()
  @IsBoolean()
  pushFollows?: boolean;

  @IsOptional()
  @IsBoolean()
  pushDms?: boolean;

  @IsOptional()
  @IsBoolean()
  pushInterests?: boolean;

  @IsOptional()
  @IsBoolean()
  pushMilestones?: boolean;

  // Email
  @IsOptional()
  @IsBoolean()
  emailDigest?: boolean;

  @IsOptional()
  @IsBoolean()
  emailSecurityAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  emailMilestones?: boolean;

  // Privacy Preview
  @IsOptional()
  @IsBoolean()
  hideNotificationPreviews?: boolean;

  // Quiet Hours (User-configured local schedule, STRICT ZERO-LOCATION)
  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'quietHoursStart must be in HH:mm format (e.g. 22:00)',
  })
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'quietHoursEnd must be in HH:mm format (e.g. 08:00)',
  })
  quietHoursEnd?: string;

  @IsOptional()
  @IsInt()
  @Min(-720)
  @Max(840)
  clientTimezoneOffsetMinutes?: number;

  // Throttling
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxPushesPerHour?: number;
}

export class GetNotificationsQueryDto {
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class DispatchNotificationDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @IsString()
  deepLinkUrl?: string;

  @IsOptional()
  @IsString()
  dedupKey?: string;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  forceImmediatePush?: boolean;

  @IsOptional()
  @IsBoolean()
  hidePreview?: boolean;
}

export class ResolveDeepLinkDto {
  @IsString()
  @IsNotEmpty()
  url: string;
}
