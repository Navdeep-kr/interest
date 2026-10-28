import { CopyrightService } from './copyright.service';

describe('CopyrightService', () => {
  let service: CopyrightService;
  let mockDatabaseService: any;

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn(),
    };
    service = new CopyrightService(mockDatabaseService as any);
  });

  it('should detect exact audio fingerprint match for protected track', async () => {
    mockDatabaseService.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'c1',
          title: 'Midnight Neon Symphony',
          artist: 'Apex Synth Lab',
          rights_holder: 'Universal Sound Global',
          audio_fingerprint: 'fp_apex_synth_001_a9c4',
          allowed_for_remix: false,
        },
      ],
    });

    const result = await service.checkAudioFingerprint('fp_apex_synth_001_a9c4');

    expect(result.matched).toBe(true);
    expect(result.matchScore).toBeGreaterThanOrEqual(0.95);
    expect(result.track?.title).toBe('Midnight Neon Symphony');
    expect(result.track?.allowedForRemix).toBe(false);
  });

  it('should return matched false when audio fingerprint is unknown', async () => {
    mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

    const result = await service.checkAudioFingerprint('fp_unknown_sound_999');

    expect(result.matched).toBe(false);
    expect(result.matchScore).toBe(0.0);
    expect(result.track).toBeUndefined();
  });

  it('should register a new copyrighted track into the registry', async () => {
    mockDatabaseService.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'c2',
          title: 'Cyberpunk Beats',
          artist: 'DJ Pixel',
          rights_holder: 'Future Media Group',
          audio_fingerprint: 'fp_dj_pixel_002',
          allowed_for_remix: true,
        },
      ],
    });

    const track = await service.registerProtectedTrack({
      title: 'Cyberpunk Beats',
      artist: 'DJ Pixel',
      rightsHolder: 'Future Media Group',
      audioFingerprint: 'fp_dj_pixel_002',
      allowedForRemix: true,
    });

    expect(track.title).toBe('Cyberpunk Beats');
    expect(track.allowed_for_remix).toBe(true);
  });
});
