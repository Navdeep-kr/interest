import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { CampaignStatus, ApplicationStatus, ContractStatus, DeliverableStatus, DisputeStatus } from '@shared/types';

export class UpdatePortfolioDto {
  @IsString()
  @IsNotEmpty()
  bio: string;

  @IsArray()
  @IsString({ each: true })
  interestCategories: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  featuredReelIds?: string[];

  @IsNumber()
  @Min(0)
  baseRateCents: number;
}

export class CreateBrandCampaignDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  interestId: string;

  @IsString()
  @IsNotEmpty()
  interestName: string;

  @IsNumber()
  @Min(1000) // Minimum $10 campaign
  budgetMinCents: number;

  @IsNumber()
  @Min(1000)
  budgetMaxCents: number;

  @IsArray()
  @IsString({ each: true })
  requiredDeliverables: string[];

  @IsString()
  @IsNotEmpty()
  applicationDeadline: string;

  @IsString()
  @IsNotEmpty()
  campaignDeadline: string;

  @IsBoolean()
  @IsOptional()
  sponsorshipDisclosureRequired?: boolean;
}

export class ApplyToCampaignDto {
  @IsNumber()
  @Min(500)
  proposedRateCents: number;

  @IsString()
  @IsNotEmpty()
  pitchNote: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  portfolioSampleLinks?: string[];
}

export class SubmitDeliverableDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  reelId?: string;

  @IsString()
  @IsOptional()
  previewUrl?: string;

  @IsBoolean()
  hasSponsorshipDisclosure: boolean;
}

export class ReviewDeliverableDto {
  @IsBoolean()
  approved: boolean;

  @IsString()
  @IsOptional()
  feedbackNotes?: string;
}

export class RaiseDisputeDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  evidenceDescription: string;
}

export class ResolveDisputeDto {
  @IsEnum(['RESOLVED_CREATOR', 'RESOLVED_BRAND', 'MUTUALLY_CANCELLED'])
  resolution: 'RESOLVED_CREATOR' | 'RESOLVED_BRAND' | 'MUTUALLY_CANCELLED';

  @IsString()
  @IsNotEmpty()
  moderatorNotes: string;
}

export class ReconcileDirectPaymentDto {
  @IsEnum(['STRIPE_DIRECT_INVOICE', 'EXTERNAL_DIRECT_TRANSFER'])
  paymentProvider: 'STRIPE_DIRECT_INVOICE' | 'EXTERNAL_DIRECT_TRANSFER';

  @IsString()
  @IsNotEmpty()
  externalInvoiceId: string;

  @IsNumber()
  @Min(1)
  amountCents: number;

  @IsString()
  @IsNotEmpty()
  currency: string;
}
