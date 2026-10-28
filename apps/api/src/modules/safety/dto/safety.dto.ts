import {
  IsEnum,
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import {
  ReportTargetType,
  ReportCategory,
  ModerationActionType,
  AppealStatus,
  AiLabelType,
} from '@shared/types';

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @IsUUID()
  targetId: string;

  @IsEnum(ReportCategory)
  category: ReportCategory;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class AddKeywordFilterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  keyword: string;

  @IsOptional()
  @IsBoolean()
  isRegex?: boolean;
}

export class ModeratorActionDto {
  @IsEnum(ModerationActionType)
  action: ModerationActionType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  suspensionDays?: number;

  @IsOptional()
  @IsString()
  restrictionType?: 'POSTING' | 'COMMENTING' | 'MESSAGING' | 'COMMUNITY' | 'ACCOUNT_SUSPENSION';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  restrictionDays?: number;
}

export class CreateAppealDto {
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @IsUUID()
  entityId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  statement: string;
}

export class ResolveAppealDto {
  @IsString()
  decision: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateSafetySettingsDto {
  @IsOptional()
  @IsBoolean()
  personalizedAdsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  strictCommentFiltering?: boolean;
}

export class GetModerationQueueDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class GetModeratorAuditLogsDto {
  @IsOptional()
  @IsUUID()
  moderatorId?: string;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
