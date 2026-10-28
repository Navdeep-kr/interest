import { InterestsService } from './interests.service';
import { DatabaseService } from '../../database/database.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('InterestsService', () => {
  let service: InterestsService;
  let mockDatabaseService: any;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      release: jest.fn(),
    };

    mockDatabaseService = {
      query: jest.fn(),
      getClient: jest.fn().mockResolvedValue(mockClient),
    };

    service = new InterestsService(mockDatabaseService as any);
  });

  describe('seedTaxonomy', () => {
    it('should seed 300+ hierarchical interests with 512-d unit vectors', async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [], rowCount: 1 });

      const result = await service.seedTaxonomy();

      expect(result.seededCount).toBeGreaterThanOrEqual(300);
      expect(mockDatabaseService.query).toHaveBeenCalled();
    });
  });

  describe('searchInterests', () => {
    it('should return matching interests with parent title breadcrumb', async () => {
      mockDatabaseService.query.mockResolvedValue({
        rows: [
          {
            id: '11111111-1111-4111-a111-111111111111',
            slug: 'prompt-engineering',
            title: 'Prompt Engineering',
            description: 'Designing high-efficiency LLM system prompts',
            level: 2,
            icon: 'terminal-outline',
            parent_title: 'Artificial Intelligence',
          },
        ],
      });

      const results = await service.searchInterests('prompt', 10);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Prompt Engineering');
      expect(results[0].parentTitle).toBe('Artificial Intelligence');
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        ['%prompt%', 10],
      );
    });

    it('should return empty array for empty query', async () => {
      const results = await service.searchInterests('');
      expect(results).toEqual([]);
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });
  });

  describe('getRelatedInterests ("More Like This")', () => {
    it('should return related niche interests using cosine similarity against centroid', async () => {
      // Mock vector lookup for selected interest
      const fakeVector = new Array(512).fill(0);
      fakeVector[0] = 1.0;
      const fakeVectorStr = `[${fakeVector.join(',')}]`;

      mockDatabaseService.query
        .mockResolvedValueOnce({
          rows: [{ vector: fakeVectorStr }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '22222222-2222-4222-a222-222222222222',
              slug: 'autonomous-agents',
              title: 'Autonomous Agents',
              description: 'Multi-agent frameworks',
              level: 2,
              similarity: '0.92',
            },
          ],
        });

      const related = await service.getRelatedInterests(['11111111-1111-4111-a111-111111111111'], 5);

      expect(related).toHaveLength(1);
      expect(related[0].title).toBe('Autonomous Agents');
      expect(related[0].similarityScore).toBe(0.92);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('<=>'),
        expect.any(Array),
      );
    });
  });

  describe('selectInterests (Onboarding)', () => {
    const valid5Ids = [
      '11111111-1111-4111-a111-000000000001',
      '11111111-1111-4111-a111-000000000002',
      '11111111-1111-4111-a111-000000000003',
      '11111111-1111-4111-a111-000000000004',
      '11111111-1111-4111-a111-000000000005',
    ];

    it('should reject selection with fewer than 5 interests', async () => {
      await expect(
        service.selectInterests('user-1', ['id-1', 'id-2', 'id-3', 'id-4']),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept 5 interests and compute user centroid', async () => {
      const fakeVector = new Array(512).fill(0);
      fakeVector[0] = 1.0;
      const fakeVectorStr = `[${fakeVector.join(',')}]`;

      mockDatabaseService.query.mockResolvedValueOnce({
        rows: valid5Ids.map((id) => ({ id, vector: fakeVectorStr })),
      });

      const res = await service.selectInterests('user-1', valid5Ids);

      expect(res.success).toBe(true);
      expect(res.count).toBe(5);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE users\s+SET interest_vector/),
        expect.any(Array),
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

    });
  });

  describe('Interest Management (Mute / Pause / Remove)', () => {
    it('should toggle mute on user interest', async () => {
      mockDatabaseService.query.mockResolvedValue({ rowCount: 1 });

      const res = await service.toggleMute('user-1', 'interest-1', true);

      expect(res.success).toBe(true);
      expect(res.isMuted).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('is_muted = $3'),
        ['user-1', 'interest-1', true],
      );
    });

    it('should toggle pause on user interest', async () => {
      mockDatabaseService.query.mockResolvedValue({ rowCount: 1 });

      const res = await service.togglePause('user-1', 'interest-1', true);

      expect(res.success).toBe(true);
      expect(res.isPaused).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SET is_paused = $1'),
        [true, 'user-1', 'interest-1'],
      );
    });

    it('should remove interest and recalculate centroid', async () => {
      mockDatabaseService.query.mockResolvedValue({ rowCount: 1, rows: [] });

      const res = await service.removeInterest('user-1', 'interest-1');

      expect(res.success).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_interests'),
        ['user-1', 'interest-1'],
      );
    });
  });
});
