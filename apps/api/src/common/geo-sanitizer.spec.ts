import {
  stripGeoEntities,
  containsGeoEntity,
  sanitizeCaptionForRanking,
} from '@shared/geo-sanitizer';

describe('GeoSanitizer (Zero-Location Caption & Feature Sterilizer)', () => {
  it('should detect and remove GPS coordinates from text', () => {
    const inputWithCoords = 'Epic drone shot at 37.7749, -122.4194 showing mountain trail';
    const sanitized = stripGeoEntities(inputWithCoords);

    expect(sanitized).not.toContain('37.7749');
    expect(sanitized).not.toContain('-122.4194');
    expect(sanitized).toContain('Epic drone shot');
    expect(sanitized).toContain('showing mountain trail');
    expect(containsGeoEntity(inputWithCoords)).toBe(true);
  });

  it('should strip country and city names whether in prose or hashtags', () => {
    const text = 'Morning pour over coffee in Tokyo Japan #tokyo #japan #pourover #coffee';
    const sanitized = stripGeoEntities(text);

    expect(sanitized.toLowerCase()).not.toContain('tokyo');
    expect(sanitized.toLowerCase()).not.toContain('japan');
    expect(sanitized).toContain('Morning pour over coffee');
    expect(sanitized).toContain('pourover');
    expect(sanitized).toContain('coffee');
  });

  it('should strip proximity trigger phrases', () => {
    const text = 'Best calisthenics gym near me in my city with high pull-up bars';
    const sanitized = stripGeoEntities(text);

    expect(sanitized).not.toContain('near me');
    expect(sanitized).not.toContain('in my city');
    expect(sanitized).toContain('Best calisthenics gym');
    expect(sanitized).toContain('with high pull-up bars');
  });

  it('should preserve genuine interest keywords unharmed', () => {
    const pureInterestText = 'Advanced Prompt Engineering for Autonomous Agents and LLM Workflows';
    const sanitized = stripGeoEntities(pureInterestText);

    expect(sanitized).toBe('Advanced Prompt Engineering for Autonomous Agents and LLM Workflows');
    expect(containsGeoEntity(pureInterestText)).toBe(false);
  });

  it('should guarantee two identical interest captions in different locations produce identical sanitized corpora', () => {
    const captionParis = 'Crafting sourdough bread at 7am in Paris France #paris #sourdough';
    const captionTokyo = 'Crafting sourdough bread at 7am in Tokyo Japan #tokyo #sourdough';

    const resultParis = sanitizeCaptionForRanking(captionParis);
    const resultTokyo = sanitizeCaptionForRanking(captionTokyo);

    expect(resultParis.sanitizedCorpus).toBe(resultTokyo.sanitizedCorpus);
    expect(resultParis.sanitizedCorpus).toContain('Crafting sourdough bread at 7am');
    expect(resultParis.sanitizedCorpus).toContain('sourdough');
    expect(resultParis.detectedGeoEntities).toContain('paris');
    expect(resultTokyo.detectedGeoEntities).toContain('tokyo');
  });
});
