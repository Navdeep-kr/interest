import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, IsArray } from 'class-validator';

export enum SupportedSocialPlatform {
  INSTAGRAM = 'instagram',
  TIKTOK = 'tiktok',
  YOUTUBE = 'youtube',
  TWITTER = 'twitter',
}

export class DirectSocialImportDto {
  @IsEnum(SupportedSocialPlatform, {
    message: 'provider must be instagram, tiktok, youtube, or twitter',
  })
  @IsNotEmpty()
  provider: SupportedSocialPlatform;

  @IsString()
  @IsNotEmpty()
  externalHandle: string; // e.g., 'craft_woodworker' or 'latte_artist'

  @IsString()
  @IsOptional()
  accessToken?: string;

  @IsBoolean()
  @IsOptional()
  autoImportProfile?: boolean = true;

  @IsBoolean()
  @IsOptional()
  autoImportReels?: boolean = true;

  @IsString()
  @IsOptional()
  birthdate?: string = '2000-01-01'; // Default adult age for COPPA compliance

  @IsString()
  @IsOptional()
  deviceName?: string;
}

export class PreviewExternalReelsDto {
  @IsEnum(SupportedSocialPlatform)
  @IsNotEmpty()
  provider: SupportedSocialPlatform;

  @IsString()
  @IsNotEmpty()
  externalHandle: string;
}

export class ExecuteReelsImportDto {
  @IsEnum(SupportedSocialPlatform)
  @IsNotEmpty()
  provider: SupportedSocialPlatform;

  @IsString()
  @IsNotEmpty()
  externalHandle: string;

  @IsArray()
  @IsOptional()
  selectedExternalIds?: string[]; // If omitted or empty, imports all available reels

  @IsBoolean()
  @IsOptional()
  autoPublish?: boolean = true;
}
