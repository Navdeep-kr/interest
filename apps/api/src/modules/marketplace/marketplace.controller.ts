import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import {
  CreateBrandCampaignDto,
  ApplyToCampaignDto,
  SubmitDeliverableDto,
  ReviewDeliverableDto,
  RaiseDisputeDto,
  ResolveDisputeDto,
  ReconcileDirectPaymentDto,
  UpdatePortfolioDto,
} from './dto/marketplace.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('metrics')
  getDemandMetrics() {
    return this.marketplaceService.getDemandMetrics();
  }

  @UseGuards(JwtAuthGuard)
  @Get('eligibility')
  checkEligibility(@Request() req: any) {
    const userId = req.user?.id || 'demo_user';
    return this.marketplaceService.checkEligibility(userId);
  }

  @Get('portfolio/:creatorId')
  getPortfolio(@Param('creatorId') creatorId: string) {
    return this.marketplaceService.getPortfolio(creatorId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('portfolio')
  updatePortfolio(@Request() req: any, @Body() dto: UpdatePortfolioDto) {
    const creatorId = req.user?.id || 'demo_user';
    return this.marketplaceService.updatePortfolio(creatorId, dto);
  }

  @Get('campaigns')
  listCampaigns(
    @Query('interestId') interestId?: string,
    @Query('status') status?: string,
  ) {
    return this.marketplaceService.listCampaigns({ interestId, status });
  }

  @Get('campaigns/:id')
  getCampaign(@Param('id') id: string) {
    return this.marketplaceService.getCampaignById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns')
  createCampaign(@Request() req: any, @Body() dto: CreateBrandCampaignDto) {
    const brandId = req.user?.id || 'brand_demo';
    const brandName = req.user?.displayName || req.user?.username || 'Verified Brand';
    return this.marketplaceService.createCampaign(brandId, brandName, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/apply')
  applyToCampaign(
    @Request() req: any,
    @Param('id') campaignId: string,
    @Body() dto: ApplyToCampaignDto,
  ) {
    const creatorId = req.user?.id || 'creator_demo';
    const creatorUsername = req.user?.username || 'creator_user';
    return this.marketplaceService.applyToCampaign(creatorId, creatorUsername, campaignId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('campaigns/:id/applications')
  listApplications(@Request() req: any, @Param('id') campaignId: string) {
    const brandId = req.user?.id || 'brand_demo';
    return this.marketplaceService.listApplications(brandId, campaignId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:id/applications/:appId/accept')
  acceptApplication(
    @Request() req: any,
    @Param('id') campaignId: string,
    @Param('appId') appId: string,
  ) {
    const brandId = req.user?.id || 'brand_demo';
    return this.marketplaceService.acceptApplicationAndCreateContract(brandId, campaignId, appId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('contracts/:id')
  getContract(@Request() req: any, @Param('id') contractId: string) {
    const requesterId = req.user?.id || 'demo_user';
    return this.marketplaceService.getContract(requesterId, contractId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('contracts/:id/deliverables/:delivId')
  submitDeliverable(
    @Request() req: any,
    @Param('id') contractId: string,
    @Param('delivId') delivId: string,
    @Body() dto: SubmitDeliverableDto,
  ) {
    const creatorId = req.user?.id || 'creator_demo';
    return this.marketplaceService.submitDeliverable(creatorId, contractId, delivId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('contracts/:id/deliverables/:delivId/review')
  reviewDeliverable(
    @Request() req: any,
    @Param('id') contractId: string,
    @Param('delivId') delivId: string,
    @Body() dto: ReviewDeliverableDto,
  ) {
    const brandId = req.user?.id || 'brand_demo';
    return this.marketplaceService.reviewDeliverable(brandId, contractId, delivId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('contracts/:id/dispute')
  raiseDispute(
    @Request() req: any,
    @Param('id') contractId: string,
    @Body() dto: RaiseDisputeDto,
  ) {
    const requesterId = req.user?.id || 'demo_user';
    return this.marketplaceService.raiseDispute(requesterId, contractId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('contracts/:id/dispute/resolve')
  resolveDispute(
    @Request() req: any,
    @Param('id') contractId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    const moderatorId = req.user?.id || 'admin_mod';
    return this.marketplaceService.resolveDispute(moderatorId, contractId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('contracts/:id/reconcile')
  reconcilePayment(
    @Request() req: any,
    @Param('id') contractId: string,
    @Body() dto: ReconcileDirectPaymentDto,
  ) {
    const brandId = req.user?.id || 'brand_demo';
    return this.marketplaceService.reconcilePayment(brandId, contractId, dto);
  }
}
