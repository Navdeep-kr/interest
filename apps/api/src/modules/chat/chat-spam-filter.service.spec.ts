import { Test, TestingModule } from '@nestjs/testing';
import { ChatSpamFilterService } from './chat-spam-filter.service';
import { DatabaseService } from '../../database/database.service';
import { ForbiddenException } from '@nestjs/common';

describe('ChatSpamFilterService', () => {
  let service: ChatSpamFilterService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatSpamFilterService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<ChatSpamFilterService>(ChatSpamFilterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws ForbiddenException if sender is blocked by recipient', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ exists: 1 }] }); // block check

    await expect(
      service.analyzeMessage('sender-1', 'recipient-1', 'Hello'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('routes directly to Primary Inbox if recipient follows sender', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [] }) // not blocked
      .mockResolvedValueOnce({
        rows: [
          {
            sender_follows_recipient: true,
            recipient_follows_sender: true,
          },
        ],
      });

    const res = await service.analyzeMessage('sender-1', 'recipient-1', 'Hey buddy');
    expect(res.shouldRouteToRequests).toBe(false);
    expect(res.isSpam).toBe(false);
    expect(res.isMutualFollow).toBe(true);
  });

  it('routes non-mutual strangers to Message Requests folder', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [] }) // not blocked
      .mockResolvedValueOnce({
        rows: [
          {
            sender_follows_recipient: true,
            recipient_follows_sender: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ stranger_conv_count: 0 }] }); // rate burst

    const res = await service.analyzeMessage('sender-1', 'recipient-1', 'Hi there, loved your reel');
    expect(res.shouldRouteToRequests).toBe(true);
    expect(res.isSpam).toBe(false);
  });

  it('flags telegram / phishing links as spam', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [] }) // not blocked
      .mockResolvedValueOnce({
        rows: [
          {
            sender_follows_recipient: false,
            recipient_follows_sender: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ stranger_conv_count: 0 }] });

    const res = await service.analyzeMessage(
      'sender-1',
      'recipient-1',
      'Join our group now: t.me/free_crypto_airdrop',
    );
    expect(res.isSpam).toBe(true);
    expect(res.spamScore).toBeGreaterThanOrEqual(0.7);
    expect(res.shouldRouteToRequests).toBe(true);
  });
});
