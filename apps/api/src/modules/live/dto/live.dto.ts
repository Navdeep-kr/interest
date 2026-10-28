import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsIn,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import {
  StreamHealthStatus,
  LiveReactionType,
} from '@shared/types';

export class CreateLiveEventDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  description: string;

  @IsString()
  interestId: string;

  @IsString()
  interestName: string;

  @IsString()
  scheduledStartTime: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  is18Plus?: boolean;

  @IsOptional()
  @IsBoolean()
  recordSession?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(90)
  recordingRetentionDays?: number;
}

export class UpdateStreamHealthDto {
  @IsNumber()
  @Min(0)
  bitrateKbps: number;

  @IsNumber()
  @Min(0)
  fps: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  droppedFramePercent: number;

  @IsNumber()
  @Min(0)
  jitterMs: number;

  @IsIn(['HEALTHY', 'DEGRADED', 'CRITICAL', 'RECONNECTING'])
  status: StreamHealthStatus;
}

export class InviteCoHostDto {
  @IsString()
  guestUserId: string;

  @IsString()
  guestUsername: string;
}

export class RespondCoHostInviteDto {
  @IsBoolean()
  accept: boolean;
}

export class SubmitLiveQuestionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  question: string;
}

export class ModerateQuestionDto {
  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;

  @IsOptional()
  @IsBoolean()
  isAnswered?: boolean;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class EmitReactionDto {
  @IsIn(['HEART', 'FIRE', 'CELEBRATE', 'MINDBLOWN', 'CLAP'])
  reaction: LiveReactionType;
}

export class ReportLiveStreamDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;

  @IsString()
  category: string;
}
