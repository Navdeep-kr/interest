import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsIn,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';
import {
  StoryMediaType,
  StoryAudience,
  StoryReplySetting,
  TextOverlayItem,
} from '@shared/types';

export class CreateStoryInputDto {
  @IsNotEmpty()
  @IsIn(['PHOTO', 'VIDEO'])
  mediaType: StoryMediaType;

  @IsNotEmpty()
  @IsString()
  mediaUrl: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(1.0)
  @Max(60.0)
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsArray()
  textOverlays?: TextOverlayItem[];

  @IsOptional()
  @IsIn(['PUBLIC', 'FOLLOWERS_ONLY', 'CLOSE_FRIENDS'])
  audience?: StoryAudience;

  @IsOptional()
  @IsIn(['ALL', 'FOLLOWERS', 'OFF'])
  allowReplies?: StoryReplySetting;
}

export class RecordStoryViewInputDto {
  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  progressPercent?: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class ReactToStoryInputDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  reaction: string;
}

export class ReplyToStoryInputDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  text: string;
}

export class ReportStoryInputDto {
  @IsNotEmpty()
  @IsIn(['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'INAPPROPRIATE', 'COPYRIGHT', 'OTHER'])
  reason: 'SPAM' | 'HARASSMENT' | 'HATE_SPEECH' | 'INAPPROPRIATE' | 'COPYRIGHT' | 'OTHER';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
