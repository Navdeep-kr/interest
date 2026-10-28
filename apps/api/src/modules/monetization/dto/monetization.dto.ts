import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsArray,
  IsUUID,
  IsUrl,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PaymentGateway,
  CommunityPricingType,
  AdBidType,
  AdEventType,
  TaxEntityType,
} from '@shared/types';

export class CreateSubscriptionPlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsInt()
  @Min(100) // Minimum $1.00 (100 cents)
  priceCents!: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['month', 'year'])
  billingInterval?: 'month' | 'year';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  perks?: string[];
}

export class SubscribeToPlanDto {
  @IsUUID()
  @IsNotEmpty()
  planId!: string;

  @IsEnum(PaymentGateway)
  @IsNotEmpty()
  gateway!: PaymentGateway;

  @IsString()
  @IsOptional()
  paymentMethodToken?: string;
}

export class SendTipDto {
  @IsUUID()
  @IsNotEmpty()
  creatorId!: string;

  @IsUUID()
  @IsOptional()
  reelId?: string;

  @IsInt()
  @Min(50) // Minimum $0.50 (50 cents)
  amountCents!: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  message?: string;

  @IsEnum(PaymentGateway)
  @IsNotEmpty()
  gateway!: PaymentGateway;

  @IsString()
  @IsOptional()
  paymentMethodToken?: string;
}

export class CreatePaidCommunityDto {
  @IsUUID()
  @IsNotEmpty()
  interestId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUrl()
  @IsOptional()
  bannerUrl?: string;

  @IsEnum(CommunityPricingType)
  pricingType!: CommunityPricingType;

  @IsInt()
  @Min(100)
  priceCents!: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  @IsEnum(['month', 'year'])
  billingInterval?: 'month' | 'year';
}

export class JoinPaidCommunityDto {
  @IsUUID()
  @IsNotEmpty()
  communityId!: string;

  @IsEnum(PaymentGateway)
  @IsNotEmpty()
  gateway!: PaymentGateway;

  @IsString()
  @IsOptional()
  paymentMethodToken?: string;
}

// Strictly Zero-Location Ad Campaign Creation: ONLY interest targeting allowed
export class CreateAdCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsUUID()
  @IsNotEmpty()
  reelId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  targetInterestIds!: string[];

  @IsUrl()
  @IsOptional()
  callToActionUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  callToActionText?: string;

  @IsInt()
  @Min(500) // Minimum $5.00 daily budget
  dailyBudgetCents!: number;

  @IsInt()
  @Min(1000) // Minimum $10.00 total budget
  totalBudgetCents!: number;

  @IsEnum(AdBidType)
  @IsOptional()
  bidType?: AdBidType;

  @IsInt()
  @Min(10) // Minimum bid
  bidCents!: number;
}

export class TrackAdEventDto {
  @IsUUID()
  @IsNotEmpty()
  campaignId!: string;

  @IsEnum(AdEventType)
  @IsNotEmpty()
  eventType!: AdEventType;

  @IsUUID()
  @IsOptional()
  interestId?: string;

  @IsString()
  @IsNotEmpty()
  attributionToken!: string;
}

export class UpdateTaxProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  taxIdNumber!: string; // TIN, EIN, GSTIN, PAN

  @IsEnum(TaxEntityType)
  @IsNotEmpty()
  taxEntityType!: TaxEntityType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  taxLegalName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  taxJurisdictionCode!: string; // e.g. 'US-W9', 'IN-GST', 'EU-VAT'

  @IsEnum(PaymentGateway)
  @IsOptional()
  gateway?: PaymentGateway;
}

export class RequestPayoutDto {
  @IsInt()
  @Min(1000) // Minimum $10.00
  @IsOptional()
  amountCents?: number;
}

export class CalculateCreatorFundDto {
  @IsString()
  @IsNotEmpty()
  periodName!: string; // e.g. '2026-10'

  @IsInt()
  @Min(10000) // Minimum $100 pool
  totalPoolCents!: number;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class VerifyInAppPurchaseInputDto {
  @IsEnum(PaymentGateway)
  @IsNotEmpty()
  gateway!: PaymentGateway;

  @IsString()
  @IsNotEmpty()
  receiptOrToken!: string;

  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  transactionId!: string;

  @IsUUID()
  @IsOptional()
  creatorId?: string;

  @IsUUID()
  @IsOptional()
  planId?: string;

  @IsUUID()
  @IsOptional()
  reelId?: string;

  @IsOptional()
  isSandbox?: boolean;
}

export class RestorePurchasesInputDto {
  @IsEnum(PaymentGateway)
  @IsNotEmpty()
  gateway!: PaymentGateway;

  @IsString()
  @IsOptional()
  receiptData?: string;

  @IsString()
  @IsOptional()
  purchaseToken?: string;

  @IsString()
  @IsOptional()
  productId?: string;
}

export class CheckSubscriberContentAccessDto {
  @IsUUID()
  @IsNotEmpty()
  reelId!: string;
}

export class SubmitKycVerificationDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(['W9', 'W8BEN', 'VAT', 'GST'])
  taxFormType!: 'W9' | 'W8BEN' | 'VAT' | 'GST';

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  taxLegalName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  taxIdNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  countryCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4)
  bankAccountLast4!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  bankRoutingNumber!: string;

  @IsNotEmpty()
  certificationAccepted!: boolean;
}

