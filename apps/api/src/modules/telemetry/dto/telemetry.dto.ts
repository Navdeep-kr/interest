import { IsArray, ValidateNested, IsUUID, IsNumber, IsBoolean, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EngagementAction } from '@shared/types';

export class TelemetryEventDto {
  @IsUUID('4')
  reelId: string;

  @IsNumber()
  @Min(0)
  durationMs: number;

  @IsNumber()
  @Min(0)
  watchedMs: number;

  @IsNumber()
  @Min(0)
  loopCount: number;

  @IsBoolean()
  completedFullLoop: boolean;

  @IsEnum(EngagementAction)
  action: EngagementAction;

  @IsNumber()
  timestamp: number;
}

export class TelemetryBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TelemetryEventDto)
  events: TelemetryEventDto[];
}
