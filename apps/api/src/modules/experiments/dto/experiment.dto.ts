import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsNumber,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExperimentStatus, ExperimentVariantConfig } from '@shared/types';

export class VariantConfigDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  weight: number;

  @IsObject()
  config: Record<string, any>;
}

export class CreateExperimentDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantConfigDto)
  variants: VariantConfigDto[];

  @IsOptional()
  @IsString()
  salt?: string;

  @IsOptional()
  @IsObject()
  targetAudienceFilter?: Record<string, any>;
}

export class UpdateExperimentStatusDto {
  @IsEnum(ExperimentStatus)
  status: ExperimentStatus;

  @IsOptional()
  @IsString()
  winnerVariantId?: string;
}

export class SetExperimentOverrideDto {
  @IsString()
  userId: string;

  @IsString()
  variantId: string;
}
