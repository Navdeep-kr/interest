import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsArray,
  IsBoolean,
  IsNumber,
  MinLength,
  MaxLength,
} from 'class-validator';
import {
  CommunityVisibility,
  CommunityMemberRole,
  CommunityPostType,
  CommunityGuideline,
} from '@shared/types';

export class CreateCommunityInputDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  interestId?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'RESTRICTED', 'PRIVATE'])
  visibility?: CommunityVisibility;

  @IsOptional()
  @IsArray()
  guidelines?: CommunityGuideline[];
}

export class UpdateCommunityInputDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  bannerUrl?: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'RESTRICTED', 'PRIVATE'])
  visibility?: CommunityVisibility;

  @IsOptional()
  @IsArray()
  guidelines?: CommunityGuideline[];
}

export class InviteCommunityMemberInputDto {
  @IsUUID()
  userId: string;
}

export class UpdateCommunityMemberRoleInputDto {
  @IsIn(['ADMIN', 'MODERATOR', 'MEMBER'])
  role: CommunityMemberRole;
}

export class ModerateCommunityMemberInputDto {
  @IsIn(['BAN', 'MUTE', 'UNBAN', 'UNMUTE'])
  action: 'BAN' | 'MUTE' | 'UNBAN' | 'UNMUTE';

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsNumber()
  muteDurationHours?: number;
}

export class HandoverCommunityOwnershipInputDto {
  @IsUUID()
  newOwnerId: string;
}

export class CreateCommunityPostInputDto {
  @IsOptional()
  @IsIn(['DISCUSSION', 'SHARED_REEL', 'COLLABORATIVE', 'ANNOUNCEMENT'])
  postType?: CommunityPostType;

  @IsString()
  @MinLength(2)
  @MaxLength(250)
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsArray()
  mediaUrls?: string[];

  @IsOptional()
  @IsUUID()
  reelId?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isAnnouncement?: boolean;

  @IsOptional()
  @IsArray()
  collaboratorIds?: string[];
}

export class RespondPostCollaborationInputDto {
  @IsIn(['ACCEPTED', 'DECLINED'])
  status: 'ACCEPTED' | 'DECLINED';
}

export class ReportCommunityTargetInputDto {
  @IsIn(['POST', 'MEMBER', 'COMMUNITY'])
  targetType: 'POST' | 'MEMBER' | 'COMMUNITY';

  @IsUUID()
  targetId: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  details?: string;
}

export class ReviewCommunityReportInputDto {
  @IsIn(['RESOLVED', 'DISMISSED'])
  status: 'RESOLVED' | 'DISMISSED';

  @IsOptional()
  @IsIn(['REMOVE_POST', 'BAN_MEMBER', 'MUTE_MEMBER', 'NO_ACTION'])
  actionTaken?: 'REMOVE_POST' | 'BAN_MEMBER' | 'MUTE_MEMBER' | 'NO_ACTION';
}

export class SubmitCommunityAppealInputDto {
  @IsString()
  @MinLength(5)
  appealReason: string;

  @IsOptional()
  @IsUUID()
  banOrActionId?: string;
}

export class ReviewCommunityAppealInputDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class CreateCommunityCollectionInputDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isCurated?: boolean;
}

export class AddReelToCommunityCollectionInputDto {
  @IsUUID()
  reelId: string;
}
