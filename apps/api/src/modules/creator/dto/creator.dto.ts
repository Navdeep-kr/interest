import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsNumber,
  IsObject,
  IsDateString,
  IsBoolean,
  IsIn,
  Min,
  Max,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import {
  EditorState,
  AspectRatioPreset,
  CropRect,
  SubtitleCue,
  TextOverlayItem,
  AudioMixControls,
} from '@shared/types';

export class SaveDraftInputDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  clientDraftId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

  @IsOptional()
  @IsUUID('4')
  primaryInterestId?: string;

  @IsOptional()
  @IsArray()
  secondaryTagIds?: string[];

  @IsOptional()
  @IsArray()
  hashtags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  coverTimestamp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coverFrameTimestampMs?: number;

  @IsOptional()
  @IsString()
  videoUri?: string;

  @IsOptional()
  @IsIn(['9:16', '1:1', '16:9', '4:5'])
  aspectRatio?: AspectRatioPreset;

  @IsOptional()
  @IsNumber()
  @Min(0)
  trimStartMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  trimEndMs?: number;

  @IsOptional()
  @IsObject()
  cropRect?: CropRect;

  @IsOptional()
  @IsArray()
  subtitles?: SubtitleCue[];

  @IsOptional()
  @IsArray()
  textOverlays?: TextOverlayItem[];

  @IsOptional()
  @IsObject()
  audioControls?: AudioMixControls;

  @IsOptional()
  @IsUUID('4')
  soundId?: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE'])
  visibility?: 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE';

  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @IsOptional()
  @IsBoolean()
  allowRemix?: boolean;

  @IsOptional()
  @IsBoolean()
  isCommercial?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brandName?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsObject()
  editorState?: EditorState;
}

export class ScheduleReelInputDto {
  @IsUUID('4')
  reelId: string;

  @IsDateString()
  scheduledAt: string; // ISO 8601 string

  @IsOptional()
  @IsNumber()
  clientTimezoneOffsetMinutes?: number;
}

export class PublishReelInputDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  clientPublicationId: string; // Idempotency token

  @IsOptional()
  @IsUUID('4')
  reelId?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

  @IsOptional()
  @IsUUID('4')
  primaryInterestId?: string;

  @IsOptional()
  @IsArray()
  secondaryTagIds?: string[];

  @IsOptional()
  @IsArray()
  hashtags?: string[];

  @IsOptional()
  @IsIn(['9:16', '1:1', '16:9', '4:5'])
  aspectRatio?: AspectRatioPreset;

  @IsOptional()
  @IsNumber()
  @Min(0)
  trimStartMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  trimEndMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coverFrameTimestampMs?: number;

  @IsOptional()
  @IsObject()
  cropRect?: CropRect;

  @IsOptional()
  @IsArray()
  subtitles?: SubtitleCue[];

  @IsOptional()
  @IsArray()
  textOverlays?: TextOverlayItem[];

  @IsOptional()
  @IsObject()
  audioControls?: AudioMixControls;

  @IsOptional()
  @IsUUID('4')
  soundId?: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE'])
  visibility?: 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE';

  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @IsOptional()
  @IsBoolean()
  allowRemix?: boolean;

  @IsOptional()
  @IsBoolean()
  isCommercial?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brandName?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsNumber()
  clientTimezoneOffsetMinutes?: number;
}

export class UpdatePublishedReelDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

  @IsOptional()
  @IsArray()
  hashtags?: string[];

  @IsOptional()
  @IsIn(['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE'])
  visibility?: 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE';

  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @IsOptional()
  @IsBoolean()
  allowRemix?: boolean;
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  range?: '7d' | '30d' | '90d' = '30d';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  timezone?: string = 'UTC';

  @IsOptional()
  @IsUUID('4')
  reelId?: string;
}

export class RecordEngagementEventDto {
  @IsOptional()
  @IsString()
  clientEventId?: string;

  @IsUUID('4')
  reelId: string;

  @IsNumber()
  @Min(0)
  durationMs: number;

  @IsNumber()
  @Min(0)
  watchedMs: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  loopCount?: number;

  @IsString()
  action: string;

  @IsOptional()
  @IsIn(['FOR_YOU', 'FOLLOWING', 'SEARCH', 'TOPIC_PAGE', 'COMMUNITY', 'DIRECT_LINK'])
  discoverySource?: 'FOR_YOU' | 'FOLLOWING' | 'SEARCH' | 'TOPIC_PAGE' | 'COMMUNITY' | 'DIRECT_LINK';

  @IsOptional()
  @IsString()
  sessionHash?: string;
}

