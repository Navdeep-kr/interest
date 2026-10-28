import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { TelemetryBatchDto, TelemetryEventDto } from './dto/telemetry.dto';
import { TelemetryGateway } from './telemetry.gateway';
import { EngagementAction } from '@shared/types';
import { applyVectorDrift } from '@shared/vector-math';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  // Learning rate schedule for in-session dynamic vector drift
  private readonly ACTION_WEIGHTS: Record<EngagementAction, number> = {
    [EngagementAction.QUICK_SKIP]: -0.06,
    [EngagementAction.WATCH_PARTIAL]: 0.02,
    [EngagementAction.WATCH_COMPLETE]: 0.07,
    [EngagementAction.LOOP]: 0.12,
    [EngagementAction.LIKE]: 0.15,
    [EngagementAction.SAVE]: 0.18,
    [EngagementAction.SHARE]: 0.2,
  };

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly telemetryGateway: TelemetryGateway,
  ) {}

  /**
   * Processes a batch of telemetry events from a client session.
   */
  async ingestBatch(userId: string, dto: TelemetryBatchDto) {
    if (!dto.events || dto.events.length === 0) {
      return { processed: 0 };
    }

    const client = await this.databaseService.getClient();
    let netDriftCount = 0;

    try {
      await client.query('BEGIN');

      // Fetch current user vector
      const userRes = await client.query(
        'SELECT interest_vector::text FROM users WHERE id = $1 FOR UPDATE',
        [userId],
      );

      let currentVector = userRes.rows[0]?.interest_vector
        ? DatabaseService.pgToVector(userRes.rows[0].interest_vector)
        : null;

      for (const event of dto.events) {
        // 1. Record engagement log
        const watchRatio = event.durationMs > 0 ? event.watchedMs / event.durationMs : 0;
        await client.query(
          `INSERT INTO reel_engagements
           (user_id, reel_id, duration_ms, watched_ms, watch_ratio, loop_count, action)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            userId,
            event.reelId,
            event.durationMs,
            event.watchedMs,
            watchRatio,
            event.loopCount,
            event.action,
          ],
        );

        // 2. Increment reel aggregate counters
        await this.updateReelCounters(client, event);

        // 3. Update dynamic interest affinity weights in user_interests (skipping paused interests)
        const reelInterestsRes = await client.query(
          'SELECT interest_id, is_primary FROM reel_interests WHERE reel_id = $1',
          [event.reelId],
        );

        const deltaBase = this.ACTION_WEIGHTS[event.action] || 0.02;
        for (const ri of reelInterestsRes.rows) {
          const delta = ri.is_primary ? deltaBase : deltaBase * 0.5;
          // Update existing affinity weight only if NOT paused
          const updateRes = await client.query(
            `UPDATE user_interests
             SET affinity_weight = LEAST(5.00, GREATEST(0.10, affinity_weight + $1)),
                 interaction_count = interaction_count + 1,
                 updated_at = NOW()
             WHERE user_id = $2
               AND interest_id = $3
               AND is_paused = FALSE`,
            [delta, userId, ri.interest_id],
          );

          // If user does not have this interest yet and exhibited strong engagement (like/save/loop), adopt it
          if (
            updateRes.rowCount === 0 &&
            (event.action === EngagementAction.LIKE ||
              event.action === EngagementAction.SAVE ||
              event.action === EngagementAction.LOOP)
          ) {
            await client.query(
              `INSERT INTO user_interests (user_id, interest_id, affinity_weight, interaction_count, is_muted, is_paused)
               VALUES ($1, $2, 1.10, 1, FALSE, FALSE)
               ON CONFLICT (user_id, interest_id) DO NOTHING`,
              [userId, ri.interest_id],
            );
          }
        }

        // 4. Compute vector drift if reel has an embedding
        if (currentVector) {
          const reelRes = await client.query('SELECT embedding::text FROM reels WHERE id = $1', [
            event.reelId,
          ]);

          if (reelRes.rows.length > 0 && reelRes.rows[0].embedding) {
            const reelVector = DatabaseService.pgToVector(reelRes.rows[0].embedding);
            const alpha = this.ACTION_WEIGHTS[event.action] || 0.02;

            currentVector = applyVectorDrift(currentVector, reelVector, alpha);
            netDriftCount++;
          }
        }
      }


      // 4. Save updated user vector to database
      if (currentVector && netDriftCount > 0) {
        const updatedVectorPg = DatabaseService.vectorToPg(currentVector);
        await client.query(
          'UPDATE users SET interest_vector = $1::vector, updated_at = NOW() WHERE id = $2',
          [updatedVectorPg, userId],
        );

        // Notify client over WebSocket
        this.telemetryGateway.emitVectorUpdated(userId, {
          timestamp: Date.now(),
          driftEventsCount: netDriftCount,
        });
      }

      await client.query('COMMIT');
      return { processed: dto.events.length, driftApplied: netDriftCount };
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Telemetry ingestion failed: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  private async updateReelCounters(client: any, event: TelemetryEventDto) {
    if (event.action === EngagementAction.LIKE) {
      await client.query('UPDATE reels SET like_count = like_count + 1 WHERE id = $1', [
        event.reelId,
      ]);
    } else if (event.action === EngagementAction.SAVE) {
      await client.query('UPDATE reels SET save_count = save_count + 1 WHERE id = $1', [
        event.reelId,
      ]);
    } else if (event.action === EngagementAction.SHARE) {
      await client.query('UPDATE reels SET share_count = share_count + 1 WHERE id = $1', [
        event.reelId,
      ]);
    } else if (
      event.action === EngagementAction.WATCH_COMPLETE ||
      event.action === EngagementAction.LOOP
    ) {
      await client.query('UPDATE reels SET view_count = view_count + 1 WHERE id = $1', [
        event.reelId,
      ]);
    }
  }
}
