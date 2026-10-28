import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ComplianceConsentService } from './compliance-consent.service';
import { ComplianceExportService } from './compliance-export.service';
import { ComplianceDeletionService } from './compliance-deletion.service';
import { ComplianceDmcaService } from './compliance-dmca.service';
import { ComplianceGrievanceService } from './compliance-grievance.service';
import { ComplianceRetentionService } from './compliance-retention.service';
import { CompliancePrivacyService } from './compliance-privacy.service';
import {
  UpdateConsentsDto,
  CcpaOptOutDto,
  RequestAccountDeletionDto,
  SubmitDmcaNoticeDto,
  SubmitDmcaCounterNoticeDto,
  SubmitGrievanceDto,
  UpdateGrievanceStatusDto,
  UpdatePrivacySettingsDto,
} from './dto/compliance.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('compliance')
@UseGuards(JwtAuthGuard)
export class ComplianceController {
  constructor(
    private readonly consentService: ComplianceConsentService,
    private readonly exportService: ComplianceExportService,
    private readonly deletionService: ComplianceDeletionService,
    private readonly dmcaService: ComplianceDmcaService,
    private readonly grievanceService: ComplianceGrievanceService,
    private readonly retentionService: ComplianceRetentionService,
    private readonly privacyService: CompliancePrivacyService,
  ) {}

  private getUserId(req: any): string {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required to access compliance resources.');
    }
    return userId;
  }

  // --------------------------------------------------------------------------
  // 1. Consent Flows & CCPA Opt-Out
  // --------------------------------------------------------------------------

  @Get('consents')
  async getUserConsents(@Request() req: any) {
    return this.consentService.getUserConsents(this.getUserId(req));
  }

  @Post('consents')
  @HttpCode(HttpStatus.OK)
  async updateConsents(@Request() req: any, @Body() dto: UpdateConsentsDto) {
    return this.consentService.updateConsents(this.getUserId(req), dto);
  }

  @Post('ccpa/opt-out')
  @HttpCode(HttpStatus.OK)
  async processCcpaOptOut(@Request() req: any, @Body() dto: CcpaOptOutDto) {
    return this.consentService.processCcpaOptOut(this.getUserId(req), dto);
  }

  // --------------------------------------------------------------------------
  // 2. Data Subject Export (GDPR Art. 20, DPDP Sec. 11)
  // --------------------------------------------------------------------------

  @Post('export')
  @HttpCode(HttpStatus.OK)
  async requestDataExport(@Request() req: any) {
    return this.exportService.requestDataExport(this.getUserId(req));
  }

  @Get('export/:id')
  async getExportStatus(@Request() req: any, @Param('id') id: string) {
    const userId = this.getUserId(req);
    const status = await this.exportService.getExportStatus(id);
    if (status.userId !== userId) {
      throw new ForbiddenException('Access denied: You cannot view export requests belonging to other users.');
    }
    return status;
  }

  @Public()
  @Get('export/:id/download')
  async downloadExportBundle(@Param('id') id: string, @Query('token') token: string) {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Missing download authorization token.');
    }
    const status = await this.exportService.getExportStatus(id);

    const providedBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(status.downloadToken || '');
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      throw new UnauthorizedException('Invalid or forged download token.');
    }

    if (status.expiresAt && new Date() > new Date(status.expiresAt)) {
      throw new ForbiddenException('Download token has expired. Please request a new data export.');
    }

    return this.exportService.generateExportBundle(status.userId);
  }

  // --------------------------------------------------------------------------
  // 3. Right to Erasure, Account Deletion & Retryable Jobs
  // --------------------------------------------------------------------------

  @Post('account/delete')
  @HttpCode(HttpStatus.OK)
  async requestAccountDeletion(@Request() req: any, @Body() dto: RequestAccountDeletionDto) {
    return this.deletionService.requestAccountDeletion(this.getUserId(req), dto);
  }

  @Post('account/cancel-deletion')
  @HttpCode(HttpStatus.OK)
  async cancelAccountDeletion(@Request() req: any) {
    return this.deletionService.cancelAccountDeletion(this.getUserId(req));
  }

  @Get('account/deletion-jobs')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  async getDeletionJobs(@Query('limit') limit?: number) {
    return this.deletionService.getDeletionJobs(limit);
  }

  @Post('account/execute-job/:jobId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  async executeDeletionJob(@Param('jobId') jobId: string) {
    return this.deletionService.executeRetryableDeletionJob(jobId);
  }

  // --------------------------------------------------------------------------
  // 4. Privacy Settings & Discoverability Controls
  // --------------------------------------------------------------------------

  @Get('privacy-settings')
  async getPrivacySettings(@Request() req: any) {
    return this.privacyService.getPrivacySettings(this.getUserId(req));
  }

  @Put('privacy-settings')
  async updatePrivacySettings(@Request() req: any, @Body() dto: UpdatePrivacySettingsDto) {
    return this.privacyService.updatePrivacySettings(this.getUserId(req), dto);
  }

  // --------------------------------------------------------------------------
  // 5. Active Device Sessions & Revocation
  // --------------------------------------------------------------------------

  @Get('sessions')
  async getUserSessions(@Request() req: any) {
    return this.privacyService.getUserSessions(this.getUserId(req), req.user?.sessionId);
  }

  @Delete('sessions/all-other')
  async revokeAllOtherSessions(@Request() req: any) {
    return this.privacyService.revokeAllOtherSessions(this.getUserId(req), req.user?.sessionId);
  }

  @Delete('sessions/:sessionId')
  async revokeSession(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.privacyService.revokeSession(this.getUserId(req), sessionId);
  }

  // --------------------------------------------------------------------------
  // 6. DMCA Notice & Takedown Workflow (17 U.S.C. § 512)
  // --------------------------------------------------------------------------

  @Public()
  @Post('dmca/notice')
  @HttpCode(HttpStatus.OK)
  async submitDmcaNotice(@Body() dto: SubmitDmcaNoticeDto) {
    return this.dmcaService.submitDmcaNotice(dto);
  }

  @Public()
  @Post('dmca/counter-notice')
  @HttpCode(HttpStatus.OK)
  async submitCounterNotice(@Body() dto: SubmitDmcaCounterNoticeDto) {
    return this.dmcaService.submitCounterNotice(dto);
  }

  @Public()
  @Get('dmca/:ticketNumber')
  async getDmcaStatus(@Param('ticketNumber') ticketNumber: string) {
    return this.dmcaService.getTakedownStatus(ticketNumber);
  }

  // --------------------------------------------------------------------------
  // 7. Grievance Redressal (India DPDP Act & Global Compliance)
  // --------------------------------------------------------------------------

  @Public()
  @Post('grievance')
  @HttpCode(HttpStatus.OK)
  async submitGrievance(@Body() dto: SubmitGrievanceDto) {
    return this.grievanceService.submitGrievance(dto);
  }

  @Public()
  @Get('grievance/:ticketNumber')
  async getGrievance(@Param('ticketNumber') ticketNumber: string) {
    return this.grievanceService.getGrievance(ticketNumber);
  }

  @Get('grievances')
  @UseGuards(RolesGuard)
  @Roles('MODERATOR', 'ADMIN', 'SUPERADMIN')
  async listGrievances() {
    return this.grievanceService.listGrievances();
  }

  @Post('grievance/:ticketNumber/status')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('MODERATOR', 'ADMIN', 'SUPERADMIN')
  async updateGrievanceStatus(
    @Param('ticketNumber') ticketNumber: string,
    @Body() dto: UpdateGrievanceStatusDto,
  ) {
    return this.grievanceService.updateGrievanceStatus(ticketNumber, dto);
  }

  // --------------------------------------------------------------------------
  // 8. Data Retention Schedules
  // --------------------------------------------------------------------------

  @Public()
  @Get('retention-policies')
  getRetentionPolicies() {
    return this.retentionService.getRetentionPolicies();
  }
}
