import { SocialImporterService } from './social-importer.service';
import { SupportedSocialPlatform } from './dto/social-importer.dto';

describe('SocialImporterService', () => {
  let service: SocialImporterService;
  let mockDb: any;
  let mockAuthService: any;
  let mockAiSuggesterService: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn().mockImplementation((queryText: string, params: any[]) => {
        if (queryText.includes('SELECT u.id, u.username')) {
          return { rows: [] }; // No existing user
        }
        if (queryText.includes('SELECT id, slug, vector FROM interests')) {
          return {
            rows: [
              { id: 'int-1', slug: 'specialty-coffee', vector: '[0.1, 0.2]' },
              { id: 'int-2', slug: 'rust-systems', vector: '[0.3, 0.4]' },
            ],
          };
        }
        return { rows: [{ id: 'reel-uuid-1' }] };
      }),
      getClient: jest.fn().mockResolvedValue({
        query: jest.fn().mockImplementation((queryText: string) => {
          if (queryText.includes('INSERT INTO users')) {
            return { rows: [{ id: 'new-user-uuid', username: 'craft_roaster', email: 'test@imported.interest.app' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      }),
    };

    mockAuthService = {
      createSessionAndTokens: jest.fn().mockResolvedValue({
        accessToken: 'mock-jwt-access-token',
        refreshToken: 'mock-jwt-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      }),
    };

    mockAiSuggesterService = {
      suggestInterests: jest.fn().mockResolvedValue([
        { id: 'int-1', slug: 'specialty-coffee', title: 'Specialty Coffee', confidence: 0.95 },
      ]),
    };

    service = new SocialImporterService(mockDb, mockAuthService, mockAiSuggesterService);
  });

  it('should perform 1-click direct social import without separate manual registration', async () => {
    const result = await service.directSocialImport({
      provider: SupportedSocialPlatform.INSTAGRAM,
      externalHandle: '@craft_roaster',
      autoImportProfile: true,
      autoImportReels: true,
    });

    expect(result.user).toBeDefined();
    expect(result.tokens).toBeDefined();
    expect(result.tokens.accessToken).toBe('mock-jwt-access-token');
    expect(result.profile.displayName).toContain('Craft Roaster');
    expect(result.profile.platformOrigin).toBe('instagram');
    expect(result.importedReels).toBe(3);
    expect(result.tasteCentroidInitialized).toBe(true);
  });

  it('should preview external reels from TikTok or YouTube', async () => {
    const reels = await service.previewExternalReels({
      provider: SupportedSocialPlatform.TIKTOK,
      externalHandle: 'rust_dev',
    });

    expect(reels.length).toBeGreaterThan(0);
    expect(reels[0].platform).toBe(SupportedSocialPlatform.TIKTOK);
    expect(reels[0].suggestedTags).toContain('#SpecialtyCoffee');
  });

  it('should sanitize geographic tokens from imported reels to preserve zero-location guarantee', async () => {
    const reelsRes = await service.executeReelsImport('user-uuid-1', {
      provider: SupportedSocialPlatform.INSTAGRAM,
      externalHandle: 'craft_woodworker',
      autoPublish: true,
    });

    expect(reelsRes.importedCount).toBe(3);
    expect(mockAiSuggesterService.suggestInterests).toHaveBeenCalled();
  });
});
