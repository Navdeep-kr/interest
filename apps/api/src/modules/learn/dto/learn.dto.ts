import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  IsBoolean,
  IsNumber,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import {
  SkillLevel,
  LearnContentType,
  CredentialClassification,
  DifficultyVoteType,
} from '@shared/types';

export class CreateSkillPathDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @IsString()
  interestId: string;

  @IsString()
  interestName: string;

  @IsIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
  level: SkillLevel;

  @IsIn([
    'VERIFIED_CREDENTIAL',
    'ACCREDITED_CERTIFICATION',
    'INFORMAL_CREATOR_TIP',
    'COMMUNITY_WORKSHOP',
  ])
  classification: CredentialClassification;

  @IsOptional()
  @IsBoolean()
  isVerifiedCredential?: boolean;

  @IsOptional()
  @IsString()
  issuingOrganization?: string;

  @IsOptional()
  @IsString()
  verificationBadgeUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisitePathIds?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  estimatedDurationMinutes?: number;
}

export class CreateLessonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(140)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(3000)
  description: string;

  @IsIn(['VIDEO', 'ARTICLE', 'QUIZ', 'PROJECT_BRIEF'])
  contentType: LearnContentType;

  @IsOptional()
  @IsString()
  contentUrl?: string;

  @IsOptional()
  @IsString()
  reelId?: string;

  @IsNumber()
  @Min(1)
  durationSeconds: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerequisiteLessonIds?: string[];

  @IsOptional()
  @IsNumber()
  orderIndex?: number;
}

export class RecordLessonProgressDto {
  @IsString()
  pathId: string;

  @IsString()
  lessonId: string;

  @IsBoolean()
  completed: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  timeSpentSeconds?: number;
}

export class SubmitDifficultyFeedbackDto {
  @IsString()
  pathId: string;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsIn(['TOO_EASY', 'JUST_RIGHT', 'TOO_HARD'])
  feedback: DifficultyVoteType;

  @IsNumber()
  @Min(1)
  @Max(5)
  ratingScore: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comments?: string;
}

export class UpdateLearnReminderDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  reminderTime: string; // "HH:MM" e.g. "19:00"

  @IsArray()
  @IsNumber({}, { each: true })
  daysOfWeek: number[]; // 1-7

  @IsIn(['IN_APP', 'PUSH'])
  channel: 'IN_APP' | 'PUSH';

  @IsOptional()
  @IsString()
  targetSkillPathId?: string;
}
