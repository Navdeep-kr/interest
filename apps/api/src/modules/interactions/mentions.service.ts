import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface MentionResult {
  extractedUsernames: string[];
  notifiedUserIds: string[];
}

@Injectable()
export class MentionsService {
  private readonly logger = new Logger(MentionsService.name);
  private readonly MENTION_REGEX = /@([a-zA-Z0-9_]{3,30})/g;

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Extracts unique `@username` mentions from text body.
   */
  extractMentions(text: string): string[] {
    if (!text) return [];
    const matches = text.match(this.MENTION_REGEX);
    if (!matches) return [];

    const usernames = matches.map((m) => m.slice(1).toLowerCase());
    return Array.from(new Set(usernames));
  }

  /**
   * Resolves usernames against the database and dispatches MENTION notifications.
   */
  async processMentions(
    actorId: string,
    text: string,
    entityId: string,
  ): Promise<MentionResult> {
    const extractedUsernames = this.extractMentions(text);
    if (extractedUsernames.length === 0) {
      return { extractedUsernames: [], notifiedUserIds: [] };
    }

    try {
      const res = await this.databaseService.query(
        `SELECT id, LOWER(username) as username FROM users WHERE LOWER(username) = ANY($1)`,
        [extractedUsernames],
      );

      const targetUsers = res.rows.filter((u) => u.id !== actorId); // Do not notify self
      const notifiedUserIds: string[] = [];

      for (const target of targetUsers) {
        await this.databaseService.query(
          `INSERT INTO notifications (user_id, actor_id, type, entity_id, is_read, created_at)
           VALUES ($1, $2, 'MENTION', $3, FALSE, NOW())`,
          [target.id, actorId, entityId],
        );
        notifiedUserIds.push(target.id);
      }

      return {
        extractedUsernames,
        notifiedUserIds,
      };
    } catch (err) {
      this.logger.warn(`Failed to process mentions: ${err.message}`);
      return { extractedUsernames, notifiedUserIds: [] };
    }
  }
}
