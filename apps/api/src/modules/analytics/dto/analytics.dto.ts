import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsNumber,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AnalyticsEventName } from '@shared/types';

export class TrackEventDto {
  @IsString()
  eventName: AnalyticsEventName | string;

  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  anonymousId?: string;

  @IsOptional()
  @IsNumber()
  timestamp?: number;
}

export class TrackBatchEventsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events: TrackEventDto[];
}

export class FunnelFilterDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  segmentInterestId?: string;

  @IsOptional()
  @IsString()
  variantId?: string;
}

export class RetentionFilterDto {
  @IsOptional()
  @IsNumber()
  cohortDays?: number;

  @IsOptional()
  @IsString()
  tierFilter?: string;
}

export class SatisfactionFilterDto {
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsNumber()
  minImpressions?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
