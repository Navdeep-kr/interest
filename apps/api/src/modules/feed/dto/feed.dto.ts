import { IsOptional, IsInt, Min, Max, IsString, IsEnum, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { FeedMode, FeedControlAction } from '@shared/types';

export class GetFeedDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(FeedMode)
  mode?: FeedMode = FeedMode.FOR_YOU;

  @IsOptional()
  @IsUUID('4')
  interestId?: string;

  @IsOptional()
  @IsString()
  interestSlug?: string;
}

export class FeedControlInputDto {
  @IsUUID('4')
  reelId: string;

  @IsEnum(FeedControlAction)
  action: FeedControlAction;

  @IsOptional()
  @IsUUID('4')
  interestId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
