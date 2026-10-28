import { EmailNotificationService } from './email-notification.service';

describe('EmailNotificationService', () => {
  let service: EmailNotificationService;
  let mockDatabaseService: any;

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn(),
    };
    service = new EmailNotificationService(mockDatabaseService as any);
  });

  it('should send security alert email when user has valid email', async () => {
    mockDatabaseService.query.mockResolvedValueOnce({
      rows: [{ email: 'creator@example.com' }],
    });

    const sent = await service.sendEmailToUser(
      'user-1',
      'Security Alert: New sign-in',
      'SECURITY',
      { deviceName: 'Chrome on Mac OS' },
    );

    expect(sent).toBe(true);
    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT email FROM users'),
      ['user-1'],
    );
  });

  it('should return false if user email is missing', async () => {
    mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

    const sent = await service.sendEmailToUser(
      'user-unknown',
      'Alert',
      'SECURITY',
      {},
    );

    expect(sent).toBe(false);
  });
});
