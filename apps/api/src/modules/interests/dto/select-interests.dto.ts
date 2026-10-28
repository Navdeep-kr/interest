import { IsArray, ArrayMinSize, ArrayMaxSize, IsUUID, IsBoolean, IsOptional, IsString } from 'class-validator';

export class SelectInterestsDto {
  @IsArray()
  @ArrayMinSize(5, { message: 'Please select at least 5 niche interests to personalize your feed.' })
  @ArrayMaxSize(15, { message: 'Maximum 15 initial interests allowed during onboarding.' })
  @IsUUID('4', { each: true, message: 'Each interest ID must be a valid UUIDv4' })
  interestIds: string[];
}

export class AddInterestDto {
  @IsUUID('4', { message: 'Interest ID must be a valid UUIDv4' })
  interestId: string;
}

export class ToggleMuteDto {
  @IsBoolean()
  isMuted: boolean;
}

export class TogglePauseDto {
  @IsBoolean()
  isPaused: boolean;
}

export class SearchInterestsDto {
  @IsString()
  q: string;

  @IsOptional()
  limit?: number;
}

export class CreateTopicDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

