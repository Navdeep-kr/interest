import { NotificationBatchProcessor } from './notification-batch.processor';
import { NotificationType } from '@shared/types';

describe('NotificationBatchProcessor (Smart Batching & Rollup Aggregation)', () => {
  let processor: NotificationBatchProcessor;
  let mockDatabaseService: any;
  let mockPushService: any;

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn(),
    };
    mockPushService = {
      sendToUser: jest.fn().mockResolvedValue({ successCount: 1 }),
    };

    processor = new NotificationBatchProcessor(
      mockDatabaseService as any,
      mockPushService as any,
    );
  });

  it('should aggregate 5 like events into a single consolidated rollup notification', async () => {
    // 1. Buffer query rows
    mockDatabaseService.query
      .mockResolvedValueOnce({
        rows: [
          { id: 'b-1', actor_id: 'u-1', display_name: 'Alice', created_at: new Date() },
          { id: 'b-2', actor_id: 'u-2', display_name: 'Bob', created_at: new Date() },
          { id: 'b-3', actor_id: 'u-3', display_name: 'Charlie', created_at: new Date() },
          { id: 'b-4', actor_id: 'u-4', display_name: 'Diana', created_at: new Date() },
          { id: 'b-5', actor_id: 'u-5', display_name: 'Evan', created_at: new Date() },
        ],
      })
      // 2. Reel title query
      .mockResolvedValueOnce({
        rows: [{ title: 'Handstand Mastery' }],
      })
      // 3. Insert batched notification
      .mockResolvedValueOnce({
        rows: [{ id: 'notif-consolidated-1' }],
      })
      // 4. Delete processed buffer rows
      .mockResolvedValueOnce({ rows: [] });

    const job: any = {
      data: {
        userId: 'creator-1',
        type: NotificationType.LIKE,
        entityId: 'reel-10',
      },
    };

    const res = await processor.process(job);

    expect(res.rolledUp).toBe(5);
    expect(res.notificationId).toBe('notif-consolidated-1');

    // Verify insert call with aggregated title and body
    const insertCall = mockDatabaseService.query.mock.calls[2];
    expect(insertCall[1][5]).toContain('Alice, Bob, and 3 others liked your reel');
    expect(insertCall[1][6]).toContain('"Handstand Mastery"');

    // Verify single push sent
    expect(mockPushService.sendToUser).toHaveBeenCalledTimes(1);
    expect(mockPushService.sendToUser).toHaveBeenCalledWith(
      'creator-1',
      expect.objectContaining({
        title: expect.stringContaining('Alice, Bob, and 3 others liked your reel'),
      }),
    );
  });
});
