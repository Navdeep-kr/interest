import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ComplianceConsentService } from './compliance-consent.service';
import { ComplianceExportService } from './compliance-export.service';
import { ComplianceDeletionService } from './compliance-deletion.service';
import { ComplianceDmcaService } from './compliance-dmca.service';
import { ComplianceGrievanceService } from './compliance-grievance.service';
import { ComplianceRetentionService } from './compliance-retention.service';
import { CompliancePrivacyService } from './compliance-privacy.service';
import { ComplianceController } from './compliance.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [ComplianceController],
  providers: [
    ComplianceConsentService,
    ComplianceExportService,
    ComplianceDeletionService,
    ComplianceDmcaService,
    ComplianceGrievanceService,
    ComplianceRetentionService,
    CompliancePrivacyService,
  ],
  exports: [
    ComplianceConsentService,
    ComplianceExportService,
    ComplianceDeletionService,
    ComplianceDmcaService,
    ComplianceGrievanceService,
    ComplianceRetentionService,
    CompliancePrivacyService,
  ],
})
export class ComplianceModule {}
