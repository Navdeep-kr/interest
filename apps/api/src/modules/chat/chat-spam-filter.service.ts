import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface SpamAnalysisResult {
  isSpam: boolean;
  spamScore: number;
  isMutualFollow: boolean;
  shouldRouteToRequests: boolean;
  reason?: string;
}

@Injectable()
export class ChatSpamFilterService {
  private readonly logger = new Logger(ChatSpamFilterService.name);

  // High-risk spam patterns: generic bot messages, external redirects, telegram/crypto spam
  private readonly SPAM_REGEX_PATTERNS = [
    /\b(t\.me|telegram\.me|wa\.me|whatsapp\.com\/send)\b/i,
    /\b(free\s+crypto|airdrop|binance\s+gift|claim\s+usdt)\b/i,
    /\b(earn\s+\$?\d+[\w\s]*per\s+day|investment\s+returns)\b/i,
    /\b(onlyfans|click\s+here\s+now|bit\.ly|tinyurl\.com)\b/i,
  ];

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Analyzes an incoming message between sender and recipient to detect spam
   * and determine whether it should route to the Primary Inbox or Message Requests folder.
   */
  async analyzeMessage(
    senderId: string,
    recipientId: string,
    messageText?: string,
  ): Promise<SpamAnalysisResult> {
    // 1. Check if recipient has blocked sender
    const blockCheck = await this.databaseService.query(
      `SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [recipientId, senderId],
    );
    if (blockCheck.rows.length > 0) {
      throw new ForbiddenException('You cannot message this user.');
    }

    // 2. Check mutual follow status
    const mutualCheck = await this.databaseService.query(
      `SELECT 
        (EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2)) AS sender_follows_recipient,
        (EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1)) AS recipient_follows_sender`,
      [senderId, recipientId],
    );

    const senderFollows = Boolean(mutualCheck.rows[0]?.sender_follows_recipient);
    const recipientFollows = Boolean(mutualCheck.rows[0]?.recipient_follows_sender);
    const isMutualFollow = senderFollows && recipientFollows;

    // If recipient follows sender or they are mutual follows -> Trusted, directly to Primary Inbox
    if (recipientFollows) {
      return {
        isSpam: false,
        spamScore: 0.0,
        isMutualFollow,
        shouldRouteToRequests: false,
      };
    }

    // 3. Sender is a non-mutual stranger: calculate spam risk heuristics
    let spamScore = 0.2; // Base risk for stranger messaging
    let flaggedReason: string | undefined;

    if (messageText) {
      // Check for suspicious URL and bot patterns
      for (const pattern of this.SPAM_REGEX_PATTERNS) {
        if (pattern.test(messageText)) {
          spamScore += 0.55;
          flaggedReason = 'Suspicious redirect or spam pattern detected.';
          break;
        }
      }

      // Check for excessive URL count
      const urlMatches = messageText.match(/https?:\/\/[^\s]+/g);
      if (urlMatches && urlMatches.length > 2) {
        spamScore += 0.3;
        flaggedReason = 'Excessive links in message from stranger.';
      }

      // Check repetitive characters / screaming caps
      if (messageText.length > 20 && messageText === messageText.toUpperCase()) {
        spamScore += 0.15;
      }
    }

    // 4. Rate-burst heuristic: check message count to strangers in the last 2 minutes
    const burstCheck = await this.databaseService.query(
      `SELECT COUNT(DISTINCT m.conversation_id) AS stranger_conv_count
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.sender_id = $1
         AND m.created_at >= NOW() - INTERVAL '2 minutes'
         AND c.status = 'PENDING'`,
      [senderId],
    );

    const burstCount = Number(burstCheck.rows[0]?.stranger_conv_count || 0);
    if (burstCount >= 5) {
      spamScore += 0.4;
      flaggedReason = 'High velocity message burst to strangers detected.';
    }

    spamScore = Math.min(1.0, parseFloat(spamScore.toFixed(2)));
    const isSpam = spamScore >= 0.7;

    return {
      isSpam,
      spamScore,
      isMutualFollow: false,
      shouldRouteToRequests: true, // Non-mutual stranger always routes to Message Requests
      reason: flaggedReason,
    };
  }
}
