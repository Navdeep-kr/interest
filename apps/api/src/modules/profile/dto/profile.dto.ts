import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  Length,
  Matches,
  IsIn,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaggingPrivacy, MentionPrivacy } from '@shared/types';

export class SocialLinkDto {
  @IsString()
  @Length(1, 50)
  title: string;

  @IsString()
  @Matches(/^https?:\/\//i, { message: 'URL must start with http:// or https://' })
  url: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_]{3,30}$/, {
    message: 'Username can only contain alphanumeric characters and underscores (3-30 chars)',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  bio?: string;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\//i, { message: 'Avatar URL must start with http:// or https://' })
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\//i, { message: 'Banner URL must start with http:// or https://' })
  bannerUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  links?: SocialLinkDto[];

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @IsOptional()
  @IsBoolean()
  hideFollowerCount?: boolean;

  @IsOptional()
  @IsBoolean()
  hideFollowingCount?: boolean;

  @IsOptional()
  @IsIn(['EVERYONE', 'FOLLOWING', 'NOBODY'])
  allowTagging?: TaggingPrivacy;

  @IsOptional()
  @IsIn(['EVERYONE', 'FOLLOWING', 'NOBODY'])
  allowMentions?: MentionPrivacy;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredLanguages?: string[];
}

export class RespondFollowRequestDto {
  @IsString()
  @IsIn(['ACCEPT', 'REJECT'])
  action: 'ACCEPT' | 'REJECT';
}

export class ProfilePaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class MentionSearchDto {
  @IsString()
  @Length(1, 50)
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
