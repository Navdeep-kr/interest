import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface EmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Dispatches an email notification to user's registered email address.
   */
  async sendEmailToUser(userId: string, subject: string, template: 'DIGEST' | 'SECURITY' | 'MILESTONE', context: Record<string, any>): Promise<boolean> {
    const userRes = await this.databaseService.query(
      `SELECT email FROM users WHERE id = $1`,
      [userId],
    );
    if (userRes.rows.length === 0 || !userRes.rows[0].email) {
      return false;
    }

    const email = userRes.rows[0].email;
    const { html, text } = this.renderTemplate(template, context);

    return this.deliverEmail({
      to: email,
      subject,
      htmlContent: html,
      textContent: text,
    });
  }

  private renderTemplate(
    template: 'DIGEST' | 'SECURITY' | 'MILESTONE',
    context: Record<string, any>,
  ): { html: string; text: string } {
    switch (template) {
      case 'SECURITY':
        return {
          html: `<div style="font-family: sans-serif; background: #09090b; color: #ffffff; padding: 24px;">
            <h2>Security Alert: New Sign-in Detected</h2>
            <p>Your Interest account was just accessed on a new device: <b>${context.deviceName || 'Unknown device'}</b>.</p>
            <p>If this was not you, please reset your password immediately.</p>
          </div>`,
          text: `Security Alert: Your Interest account was accessed on ${context.deviceName || 'a new device'}. If not you, reset your password.`,
        };

      case 'MILESTONE':
        return {
          html: `<div style="font-family: sans-serif; background: #09090b; color: #ffffff; padding: 24px;">
            <h2>🎉 Creator Milestone Reached!</h2>
            <p>Congratulations! Your reel <b>"${context.title || 'Reel'}"</b> just reached <b>${context.count || 'a milestone'} views</b>!</p>
            <p>Keep sharing high-signal content with your interest communities.</p>
          </div>`,
          text: `Creator Milestone: Your reel "${context.title}" reached ${context.count} views!`,
        };

      case 'DIGEST':
      default:
        return {
          html: `<div style="font-family: sans-serif; background: #09090b; color: #ffffff; padding: 24px;">
            <h2>Your Weekly Interest Digest</h2>
            <p>Here are the top trending reels across your selected interests this week.</p>
            <ul>${(context.reels || []).map((r: any) => `<li><b>${r.title}</b></li>`).join('')}</ul>
          </div>`,
          text: `Weekly Interest Digest: Top reels across your interests are ready to view on Interest.`,
        };
    }
  }

  private async deliverEmail(options: EmailOptions): Promise<boolean> {
    this.logger.log(`[Email Notification] Sent to ${options.to}: "${options.subject}"`);
    return true;
  }
}
