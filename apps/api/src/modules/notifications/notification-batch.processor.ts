import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PushNotificationService } from './push-notification.service';
import { NotificationType, NotificationChannel, NotificationPriority } from '@shared/types';

export interface BatchJobPayload {
  userId: string;
  type: NotificationType;
  entityId: string;
}

@Processor('notification-batch')
export class NotificationBatchProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationBatchProcessor.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pushService: PushNotificationService,
  ) {
    super();
  }

  async process(job: Job<BatchJobPayload>): Promise<any> {
    const { userId, type, entityId } = job.data;
    this.logger.log(`Processing notification batch rollup for user [${userId}], entity [${entityId}], type [${type}]`);

    // 1. Fetch pending events from buffer
    const bufferRes = await this.databaseService.query(
      `SELECT b.id, b.actor_id, b.metadata, b.created_at, p.username, p.display_name
       FROM notification_batch_buffer b
       JOIN users u ON u.id = b.actor_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE b.user_id = $1 AND b.type = $2 AND b.entity_id = $3
       ORDER BY b.created_at DESC`,
      [userId, type, entityId],
    );

    if (bufferRes.rows.length === 0) {
      return { rolledUp: 0 };
    }

    const rows = bufferRes.rows;
    const actorIds: string[] = Array.from(new Set(rows.map((r: any) => r.actor_id)));
    const actorNames: string[] = Array.from(
      new Set(rows.map((r: any) => r.display_name || r.username || 'Someone')),
    );
    const totalCount = rows.length;

    // 2. Fetch entity title if reel
    let entityTitle = 'your reel';
    if (type === NotificationType.LIKE || type === NotificationType.COMMENT) {
      const reelRes = await this.databaseService.query(
        `SELECT title FROM reels WHERE id = $1`,
        [entityId],
      );
      if (reelRes.rows.length > 0 && reelRes.rows[0].title) {
        entityTitle = `"${reelRes.rows[0].title}"`;
      }
    }

    // 3. Compose batched title and body
    let title = 'New activity on your reel';
    let body = '';

    const verb = type === NotificationType.LIKE ? 'liked' : 'commented on';

    if (actorNames.length === 1) {
      title = `${actorNames[0]} ${verb} your reel`;
      body = `${actorNames[0]} ${verb} ${entityTitle}.`;
    } else if (actorNames.length === 2) {
      title = `${actorNames[0]} and ${actorNames[1]} ${verb} your reel`;
      body = `${actorNames[0]} and ${actorNames[1]} ${verb} ${entityTitle}.`;
    } else {
      const othersCount = totalCount - 2;
      title = `${actorNames[0]}, ${actorNames[1]}, and ${othersCount} others ${verb} your reel`;
      body = `${actorNames[0]}, ${actorNames[1]}, and ${othersCount} others ${verb} ${entityTitle}.`;
    }

    // 4. Insert consolidated notification into notifications table
    const insertRes = await this.databaseService.query(
      `INSERT INTO notifications
        (user_id, actor_id, actor_ids, actor_count, type, title, body,
         entity_id, channel, priority, is_batched, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, FALSE, NOW())
       RETURNING id`,
      [
        userId,
        actorIds[0],
        actorIds,
        totalCount,
        type,
        title,
        body,
        entityId,
        NotificationChannel.IN_APP,
        NotificationPriority.NORMAL,
      ],
    );

    // 5. Send consolidated single push notification
    await this.pushService.sendToUser(userId, {
      title,
      body,
      priority: NotificationPriority.NORMAL,
      data: {
        type,
        entityId,
        notificationId: insertRes.rows[0].id,
      },
    });

    // 6. Delete processed rows from buffer
    const bufferIds = rows.map((r: any) => r.id);
    await this.databaseService.query(
      `DELETE FROM notification_batch_buffer WHERE id = ANY($1::uuid[])`,
      [bufferIds],
    );

    this.logger.log(`Successfully batched ${totalCount} events into 1 notification for user [${userId}]`);
    return { rolledUp: totalCount, notificationId: insertRes.rows[0].id };
  }
}
