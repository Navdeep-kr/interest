import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { TipsService } from './tips.service';
import { PaidCommunitiesService } from './communities.service';
import { CreatorFundService } from './creator-fund.service';
import { AdsService } from './ads.service';
import { FinancePayoutsService } from './finance-payouts.service';
import {
  CreateSubscriptionPlanDto,
  SubscribeToPlanDto,
  SendTipDto,
  CreatePaidCommunityDto,
  JoinPaidCommunityDto,
  CreateAdCampaignDto,
  TrackAdEventDto,
  UpdateTaxProfileDto,
  RequestPayoutDto,
  CalculateCreatorFundDto,
  VerifyInAppPurchaseInputDto,
  RestorePurchasesInputDto,
  SubmitKycVerificationDto,
} from './dto/monetization.dto';
import { AdCampaignStatus, PaymentGateway } from '@shared/types';

@Controller('monetization')
@UseGuards(JwtAuthGuard)
export class MonetizationController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly tipsService: TipsService,
    private readonly communitiesService: PaidCommunitiesService,
    private readonly creatorFundService: CreatorFundService,
    private readonly adsService: AdsService,
    private readonly financePayoutsService: FinancePayoutsService,
  ) {}

  // ==========================================================================
  // CREATOR SUBSCRIPTIONS & ENTITLEMENTS
  // ==========================================================================

  @Post('plans')
  @HttpCode(HttpStatus.CREATED)
  async createPlan(@Request() req: any, @Body() dto: CreateSubscriptionPlanDto) {
    return this.subscriptionsService.createPlan(req.user.id, dto);
  }

  @Get('plans/creator/:creatorId')
  async getCreatorPlans(@Param('creatorId') creatorId: string) {
    return this.subscriptionsService.getCreatorPlans(creatorId);
  }

  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  async subscribe(@Request() req: any, @Body() dto: SubscribeToPlanDto) {
    return this.subscriptionsService.subscribe(req.user.id, dto);
  }

  @Get('subscriptions/mine')
  async getMySubscriptions(@Request() req: any) {
    return this.subscriptionsService.getUserSubscriptions(req.user.id);
  }

  @Post('subscriptions/:id/cancel')
  async cancelSubscription(@Request() req: any, @Param('id') subId: string) {
    return this.subscriptionsService.cancelSubscription(req.user.id, subId);
  }

  @Get('entitlements')
  async getUserEntitlements(@Request() req: any) {
    return this.subscriptionsService.getUserEntitlements(req.user.id);
  }

  // ==========================================================================
  // IN-APP PURCHASES (APPLE STOREKIT & GOOGLE PLAY BILLING)
  // ==========================================================================

  @Post('iap/verify')
  @HttpCode(HttpStatus.OK)
  async verifyInAppPurchase(@Request() req: any, @Body() dto: VerifyInAppPurchaseInputDto) {
    return this.subscriptionsService.verifyAndProcessIap(req.user.id, dto);
  }

  @Post('iap/restore')
  @HttpCode(HttpStatus.OK)
  async restorePurchases(@Request() req: any, @Body() dto: RestorePurchasesInputDto) {
    return this.subscriptionsService.restorePurchases(req.user.id, dto);
  }

  // ==========================================================================
  // SUBSCRIBER-ONLY CONTENT ACCESS GATE
  // ==========================================================================

  @Get('content/gate/:reelId')
  async checkSubscriberContentAccess(@Request() req: any, @Param('reelId') reelId: string) {
    return this.subscriptionsService.checkSubscriberAccess(req.user.id, reelId);
  }

  // ==========================================================================
  // TIPS
  // ==========================================================================

  @Post('tips')
  @HttpCode(HttpStatus.CREATED)
  async sendTip(@Request() req: any, @Body() dto: SendTipDto) {
    return this.tipsService.sendTip(req.user.id, dto);
  }

  @Get('tips/received')
  async getReceivedTips(@Request() req: any) {
    return this.tipsService.getCreatorReceivedTips(req.user.id);
  }

  @Get('tips/sent')
  async getSentTips(@Request() req: any) {
    return this.tipsService.getUserSentTips(req.user.id);
  }

  @Get('tips/reel/:reelId')
  async getReelTips(@Param('reelId') reelId: string) {
    return this.tipsService.getReelTips(reelId);
  }

  // ==========================================================================
  // PAID INTEREST COMMUNITIES
  // ==========================================================================

  @Post('communities')
  @HttpCode(HttpStatus.CREATED)
  async createCommunity(@Request() req: any, @Body() dto: CreatePaidCommunityDto) {
    return this.communitiesService.createCommunity(req.user.id, dto);
  }

  @Get('communities/:id')
  async getCommunity(@Request() req: any, @Param('id') communityId: string) {
    return this.communitiesService.getCommunityById(communityId, req.user.id);
  }

  @Get('communities/interest/:interestId')
  async getCommunitiesByInterest(@Param('interestId') interestId: string) {
    return this.communitiesService.getCommunitiesByInterest(interestId);
  }

  @Post('communities/join')
  @HttpCode(HttpStatus.OK)
  async joinCommunity(@Request() req: any, @Body() dto: JoinPaidCommunityDto) {
    return this.communitiesService.joinCommunity(req.user.id, dto);
  }

  @Get('communities/mine')
  async getMyCommunities(@Request() req: any) {
    return this.communitiesService.getUserMemberships(req.user.id);
  }

  // ==========================================================================
  // CREATOR FUND (WATCH TIME BASED) - RESTRICTED TO ADMINS
  // ==========================================================================

  @Post('creator-fund/calculate')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @HttpCode(HttpStatus.OK)
  async calculateFund(@Body() dto: CalculateCreatorFundDto) {
    return this.creatorFundService.calculateAndDistributePool(dto);
  }

  @Get('creator-fund/allocations')
  async getMyFundAllocations(@Request() req: any) {
    return this.creatorFundService.getCreatorAllocations(req.user.id);
  }

  @Get('creator-fund/pools/:periodName')
  async getFundPool(@Param('periodName') periodName: string) {
    return this.creatorFundService.getPool(periodName);
  }

  // ==========================================================================
  // PRIVACY-FRIENDLY ADS (ZERO LOCATION)
  // ==========================================================================

  @Post('ads/campaigns')
  @HttpCode(HttpStatus.CREATED)
  async createAdCampaign(@Request() req: any, @Body() dto: CreateAdCampaignDto) {
    return this.adsService.createCampaign(req.user.id, dto);
  }

  @Get('ads/campaigns')
  async getMyCampaigns(@Request() req: any) {
    return this.adsService.getAdvertiserCampaigns(req.user.id);
  }

  @Patch('ads/campaigns/:id/status')
  async updateAdStatus(
    @Request() req: any,
    @Param('id') campaignId: string,
    @Body('status') status: AdCampaignStatus.ACTIVE | AdCampaignStatus.PAUSED,
  ) {
    return this.adsService.updateCampaignStatus(req.user.id, campaignId, status);
  }

  @Post('ads/serve')
  @HttpCode(HttpStatus.OK)
  async serveAd(
    @Body() body: { viewerInterestIds: string[]; activeInterestId?: string },
  ) {
    return this.adsService.serveAdForInterestFeed(body);
  }

  @Post('ads/events')
  @HttpCode(HttpStatus.OK)
  async trackAdEvent(@Body() dto: TrackAdEventDto) {
    return this.adsService.trackAdEvent(dto);
  }

  // ==========================================================================
  // FINANCIAL ACCOUNTS, TAXES, COMPLIANCE, INVOICES & PAYOUTS
  // ==========================================================================

  @Get('eligibility')
  async checkEligibility(@Request() req: any) {
    return this.financePayoutsService.checkCreatorEligibility(req.user.id);
  }

  @Post('kyc/submit')
  @HttpCode(HttpStatus.OK)
  async submitKyc(@Request() req: any, @Body() dto: SubmitKycVerificationDto) {
    return this.financePayoutsService.submitKycVerification(req.user.id, dto);
  }

  @Get('financial-account')
  async getFinancialAccount(@Request() req: any) {
    return this.financePayoutsService.getOrCreateFinancialAccount(req.user.id);
  }

  @Put('tax-profile')
  async updateTaxProfile(@Request() req: any, @Body() dto: UpdateTaxProfileDto) {
    return this.financePayoutsService.updateTaxProfile(req.user.id, dto);
  }

  @Get('audit-trail')
  async getAuditTrail(
    @Request() req: any,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.financePayoutsService.getAuditTrail(req.user.id, limit, offset);
  }

  @Get('invoices')
  async getInvoices(@Request() req: any) {
    return this.financePayoutsService.getUserInvoices(req.user.id);
  }

  @Post('payouts/request')
  @HttpCode(HttpStatus.CREATED)
  async requestPayout(@Request() req: any, @Body() dto: RequestPayoutDto) {
    return this.financePayoutsService.requestPayout(req.user.id, dto);
  }

  @Get('payouts')
  async getPayouts(@Request() req: any) {
    return this.financePayoutsService.getCreatorPayouts(req.user.id);
  }

  @Get('payouts/invoices')
  async getPayoutInvoices(@Request() req: any) {
    return this.financePayoutsService.getPayoutInvoices(req.user.id);
  }

  // ==========================================================================
  // CRYPTOGRAPHICALLY SIGNED PAYMENT WEBHOOKS (PUBLIC)
  // ==========================================================================

  @Public()
  @Post('webhooks/:gateway')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('gateway') gatewayStr: string,
    @Body() payload: any,
    @Headers('stripe-signature') stripeSig?: string,
    @Headers('x-razorpay-signature') razorpaySig?: string,
    @Headers('x-apple-signature') appleSig?: string,
    @Headers('x-google-signature') googleSig?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const gateway = gatewayStr.toLowerCase() as PaymentGateway;
    const signature =
      stripeSig ||
      razorpaySig ||
      appleSig ||
      googleSig ||
      authHeader ||
      '';

    if (!signature) {
      throw new BadRequestException(`Missing signature header for webhook gateway: ${gateway}`);
    }

    return this.subscriptionsService.processWebhook(gateway, payload, signature);
  }
}
