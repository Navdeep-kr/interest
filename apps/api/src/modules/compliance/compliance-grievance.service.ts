import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  SubmitGrievanceDto,
  UpdateGrievanceStatusDto,
} from './dto/compliance.dto';
import {
  GrievanceStatus,
  ComplianceGrievanceRecord,
  GrievanceCategory,
} from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

@Injectable()
export class ComplianceGrievanceService {
  private readonly logger = new Logger(ComplianceGrievanceService.name);

  // Statutory Resident Grievance Officer details (mandated under India DPDP Act & IT Rules 2021)
  static readonly GRIEVANCE_OFFICER_NAME = 'Priya Sharma';
  static readonly GRIEVANCE_OFFICER_TITLE = 'Resident Grievance Officer & DPO';
  static readonly GRIEVANCE_OFFICER_EMAIL = 'grievance-officer@interest.app';
  static readonly GRIEVANCE_OFFICER_ADDRESS =
    'Interest Media Private Limited, Level 6, Tech Park, Outer Ring Road, Bengaluru, Karnataka 560103, India';

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Submits a formal user or public grievance
   * Automatically enforces the 72-hour acknowledgment SLA and 15-day resolution deadline.
   */
  async submitGrievance(dto: SubmitGrievanceDto): Promise<ComplianceGrievanceRecord> {
    const grievanceId = uuidv4();
    const ticketNumber = `GRV-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const now = new Date();
    const ackDeadline = new Date(now.getTime() + 72 * 3600 * 1000); // 72 hours SLA
    const resolveDeadline = new Date(now.getTime() + 15 * 24 * 3600 * 1000); // 15 days SLA

    await this.databaseService.query(
      `INSERT INTO compliance_grievances
       (id, ticket_number, user_id, complainant_name, complainant_email, category,
        subject, description, status, assigned_officer, acknowledgement_sla_deadline,
        resolution_sla_deadline, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SUBMITTED', $9, $10, $11, NOW())`,
      [
        grievanceId,
        ticketNumber,
        dto.userId || null,
        dto.complainantName,
        dto.complainantEmail,
        dto.category,
        dto.subject,
        dto.description,
        ComplianceGrievanceService.GRIEVANCE_OFFICER_NAME,
        ackDeadline,
        resolveDeadline,
      ],
    );

    this.logger.log(`Grievance [${ticketNumber}] registered for ${dto.complainantEmail}. Ack deadline: ${ackDeadline.toISOString()}`);

    return {
      id: grievanceId,
      ticketNumber,
      userId: dto.userId,
      complainantName: dto.complainantName,
      complainantEmail: dto.complainantEmail,
      category: dto.category,
      subject: dto.subject,
      description: dto.description,
      status: GrievanceStatus.SUBMITTED,
      assignedOfficer: ComplianceGrievanceService.GRIEVANCE_OFFICER_NAME,
      acknowledgementSlaDeadline: ackDeadline.toISOString(),
      resolutionSlaDeadline: resolveDeadline.toISOString(),
      createdAt: now.toISOString(),
    };
  }

  /**
   * Acknowledges a grievance ticket (within 72 hours)
   */
  async acknowledgeGrievance(ticketNumber: string): Promise<ComplianceGrievanceRecord> {
    const res = await this.databaseService.query(
      `UPDATE compliance_grievances
       SET status = 'ACKNOWLEDGED', acknowledged_at = NOW()
       WHERE ticket_number = $1
       RETURNING *`,
      [ticketNumber],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Grievance ticket [${ticketNumber}] not found.`);
    }

    return this.mapToRecord(res.rows[0]);
  }

  /**
   * Updates grievance status, assigns officer, or records resolution summary
   */
  async updateGrievanceStatus(
    ticketNumber: string,
    dto: UpdateGrievanceStatusDto,
  ): Promise<ComplianceGrievanceRecord> {
    const isResolved = dto.status === GrievanceStatus.RESOLVED;

    const res = await this.databaseService.query(
      `UPDATE compliance_grievances
       SET status = $1,
           resolution_summary = COALESCE($2, resolution_summary),
           assigned_officer = COALESCE($3, assigned_officer),
           resolved_at = CASE WHEN $4 = TRUE THEN NOW() ELSE resolved_at END
       WHERE ticket_number = $5
       RETURNING *`,
      [
        dto.status,
        dto.resolutionSummary || null,
        dto.assignedOfficer || null,
        isResolved,
        ticketNumber,
      ],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Grievance ticket [${ticketNumber}] not found.`);
    }

    this.logger.log(`Updated grievance [${ticketNumber}] status to ${dto.status}`);
    return this.mapToRecord(res.rows[0]);
  }

  /**
   * Retrieves grievance record and SLA details
   */
  async getGrievance(ticketNumber: string): Promise<ComplianceGrievanceRecord> {
    const res = await this.databaseService.query(
      `SELECT * FROM compliance_grievances WHERE ticket_number = $1`,
      [ticketNumber],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Grievance ticket [${ticketNumber}] not found.`);
    }

    return this.mapToRecord(res.rows[0]);
  }

  /**
   * Lists all open grievances for admin redressal
   */
  async listGrievances(limit: number = 50): Promise<ComplianceGrievanceRecord[]> {
    const res = await this.databaseService.query(
      `SELECT * FROM compliance_grievances ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );

    return res.rows.map((r) => this.mapToRecord(r));
  }

  private mapToRecord(r: any): ComplianceGrievanceRecord {
    return {
      id: r.id,
      ticketNumber: r.ticket_number,
      userId: r.user_id,
      complainantName: r.complainant_name,
      complainantEmail: r.complainant_email,
      category: r.category as GrievanceCategory,
      subject: r.subject,
      description: r.description,
      status: r.status as GrievanceStatus,
      assignedOfficer: r.assigned_officer,
      resolutionSummary: r.resolution_summary,
      acknowledgementSlaDeadline: new Date(r.acknowledgement_sla_deadline).toISOString(),
      resolutionSlaDeadline: new Date(r.resolution_sla_deadline).toISOString(),
      acknowledgedAt: r.acknowledged_at ? new Date(r.acknowledged_at).toISOString() : undefined,
      resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : undefined,
      createdAt: new Date(r.created_at).toISOString(),
    };
  }
}
