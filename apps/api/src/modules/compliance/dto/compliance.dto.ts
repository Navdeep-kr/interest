import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsEmail,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ConsentPurpose,
  ConsentStatus,
  ComplianceJurisdiction,
  GrievanceCategory,
  GrievanceStatus,
} from '@shared/types';

export class ConsentItemDto {
  @IsEnum(ConsentPurpose)
  purpose: ConsentPurpose;

  @IsEnum(ConsentStatus)
  status: ConsentStatus;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsEnum(ComplianceJurisdiction)
  jurisdiction?: ComplianceJurisdiction;
}

export class UpdateConsentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsentItemDto)
  consents: ConsentItemDto[];

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class CcpaOptOutDto {
  @IsBoolean()
  doNotSellOrShare: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RequestDataExportDto {
  @IsOptional()
  @IsString()
  format?: 'JSON';
}

export class RequestAccountDeletionDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsBoolean()
  confirmImmediateFreeze: boolean;
}

export class CancelAccountDeletionDto {
  @IsString()
  requestId: string;
}

export class SubmitDmcaNoticeDto {
  @IsString()
  reelId: string;

  @IsString()
  claimantName: string;

  @IsEmail()
  claimantEmail: string;

  @IsString()
  copyrightedWorkDescription: string;

  @IsUrl()
  infringingMaterialUrl: string;

  @IsBoolean()
  goodFaithBeliefStatement: boolean;

  @IsBoolean()
  accuracyUnderPenaltyOfPerjury: boolean;

  @IsString()
  electronicSignature: string;
}

export class SubmitDmcaCounterNoticeDto {
  @IsString()
  ticketNumber: string;

  @IsString()
  creatorName: string;

  @IsEmail()
  creatorEmail: string;

  @IsString()
  counterNoticeStatement: string;

  @IsBoolean()
  consentToJurisdiction: boolean;

  @IsBoolean()
  statementUnderPenaltyOfPerjury: boolean;

  @IsString()
  electronicSignature: string;
}

export class SubmitGrievanceDto {
  @IsString()
  complainantName: string;

  @IsEmail()
  complainantEmail: string;

  @IsEnum(GrievanceCategory)
  category: GrievanceCategory;

  @IsString()
  subject: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class UpdateGrievanceStatusDto {
  @IsEnum(GrievanceStatus)
  status: GrievanceStatus;

  @IsOptional()
  @IsString()
  resolutionSummary?: string;

  @IsOptional()
  @IsString()
  assignedOfficer?: string;
}

export class UpdatePrivacySettingsDto {
  @IsOptional()
  @IsBoolean()
  isPrivateAccount?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSearchDiscovery?: boolean;

  @IsOptional()
  @IsEnum(['EVERYONE', 'FOLLOWERS_ONLY', 'NOBODY'])
  messagingPermission?: 'EVERYONE' | 'FOLLOWERS_ONLY' | 'NOBODY';

  @IsOptional()
  @IsEnum(['EVERYONE', 'FOLLOWERS_ONLY', 'OFF'])
  commentingPermission?: 'EVERYONE' | 'FOLLOWERS_ONLY' | 'OFF';

  @IsOptional()
  @IsBoolean()
  activityStatusVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  personalizedAdsConsent?: boolean;
}
