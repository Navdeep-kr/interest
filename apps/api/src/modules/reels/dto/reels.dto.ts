import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsUUID,
  Min,
  Max,
  IsOptional,
  MaxLength,
  IsEnum,
  ArrayMaxSize,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReelVisibility } from '@shared/types';

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/3gpp',
];

export class CreatePresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_VIDEO_MIME_TYPES, {
    message: 'contentType must be a valid video MIME type (video/mp4, video/quicktime, video/webm)',
  })
  contentType: string;

  @IsNumber()
  @Min(1024) // 1 KB min
  @Max(250 * 1024 * 1024) // 250 MB max
  fileSizeBytes: number;
}

export class InitiateMultipartUploadDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_VIDEO_MIME_TYPES, {
    message: 'contentType must be a valid video MIME type (video/mp4, video/quicktime, video/webm)',
  })
  contentType: string;

  @IsNumber()
  @Min(1024)
  @Max(250 * 1024 * 1024)
  fileSizeBytes: number;
}

export class GetMultipartPartUrlsDto {
  @IsUUID('4')
  reelId: string;

  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @IsArray()
  @IsNumber({}, { each: true })
  partNumbers: number[];
}

export class MultipartPartItemDto {
  @IsNumber()
  @Min(1)
  partNumber: number;

  @IsString()
  @IsNotEmpty()
  etag: string;
}

export class CompleteMultipartUploadDto {
  @IsUUID('4')
  reelId: string;

  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @IsString()
  @IsNotEmpty()
  s3Key: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MultipartPartItemDto)
  parts: MultipartPartItemDto[];
}

export class AbortMultipartUploadDto {
  @IsUUID('4')
  reelId: string;

  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @IsString()
  @IsNotEmpty()
  s3Key: string;
}

export class FinalizeReelDto {
  @IsUUID('4')
  reelId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  caption?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hashtags?: string[];

  @IsUUID('4')
  primaryInterestId: string;

  @IsArray()
  @ArrayMaxSize(4, { message: 'Maximum 4 secondary interest tags allowed (total 1-5 required).' })
  @IsUUID('4', { each: true })
  interestTagIds: string[];

  @IsEnum(ReelVisibility)
  @IsOptional()
  visibility?: ReelVisibility = ReelVisibility.PUBLIC;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(90)
  coverTimestampSeconds?: number = 1.0;

  @IsUUID('4')
  @IsOptional()
  audioId?: string;

  @IsString()
  @IsOptional()
  transcriptText?: string;
}

export class SuggestInterestsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  caption?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hashtags?: string[];

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  limit?: number = 5;
}

export class CreateImagePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  caption?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10, { message: 'Maximum 10 images allowed per post' })
  imageUrls: string[];

  @IsUUID('4')
  primaryInterestId: string;

  @IsArray()
  @ArrayMaxSize(4)
  @IsUUID('4', { each: true })
  @IsOptional()
  interestTagIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hashtags?: string[];

  @IsEnum(ReelVisibility)
  @IsOptional()
  visibility?: ReelVisibility = ReelVisibility.PUBLIC;
}

export class UpdateReelDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  caption?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  hashtags?: string[];

  @IsEnum(ReelVisibility)
  @IsOptional()
  visibility?: ReelVisibility;

  @IsOptional()
  isPinned?: boolean;
}

export class ReelPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;
}

