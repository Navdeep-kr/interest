import { AiInterestSuggesterService } from './ai-interest-suggester.service';
import { DatabaseService } from '../../database/database.service';

describe('AiInterestSuggesterService', () => {
  let service: AiInterestSuggesterService;
  let mockDatabaseService: any;

  beforeEach(() => {
    mockDatabaseService = {
      query: jest.fn(),
    };
    service = new AiInterestSuggesterService(mockDatabaseService as any);
  });

  it('should auto-suggest matching interests from title, caption, and hashtags', async () => {
    mockDatabaseService.query.mockImplementation((sql: string) => {
      if (sql.includes('ORDER BY (i.vector <=>')) {
        return Promise.resolve({
          rows: [
            {
              id: '11111111-1111-4111-a111-000000000001',
              slug: 'prompt-engineering',
              title: 'Prompt Engineering',
              description: 'Techniques for in-context reasoning',
              level: 2,
              parent_title: 'Artificial Intelligence & ML',
              vector_similarity: '0.94',
            },
            {
              id: '11111111-1111-4111-a111-000000000002',
              slug: 'llm-fine-tuning',
              title: 'LLM Fine-Tuning & LoRA',
              description: 'Parameter optimization',
              level: 2,
              parent_title: 'Artificial Intelligence & ML',
              vector_similarity: '0.88',
            },
          ],
        });
      }

      if (sql.includes('ILIKE ANY')) {
        return Promise.resolve({
          rows: [
            {
              id: '11111111-1111-4111-a111-000000000001',
              slug: 'prompt-engineering',
              title: 'Prompt Engineering',
              description: 'Techniques for in-context reasoning',
              level: 2,
              parent_title: 'Artificial Intelligence & ML',
            },
          ],
        });
      }

      return Promise.resolve({ rows: [] });
    });

    const suggestions = await service.suggestInterests({
      title: 'Advanced Prompt Engineering for Autonomous Agents',
      caption: 'Detailed walkthrough on Chain-of-Thought prompting',
      hashtags: ['#promptcraft', '#ai'],
      limit: 5,
    });

    expect(suggestions).toBeDefined();
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].title).toBe('Prompt Engineering');
    expect(suggestions[0].confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(suggestions[0].parentTitle).toBe('Artificial Intelligence & ML');
  });

  it('should return empty array when title and caption are empty', async () => {
    const suggestions = await service.suggestInterests({ title: '' });
    expect(suggestions).toEqual([]);
    expect(mockDatabaseService.query).not.toHaveBeenCalled();
  });

  it('should strip location entities, coordinates, and geo hashtags before suggesting interests', async () => {
    mockDatabaseService.query.mockImplementation((sql: string, params: any[]) => {
      // Assert that lexical search parameters never contain 'tokyo' or 'japan'
      if (sql.includes('ILIKE ANY')) {
        const searchTerms = params[0] as string[];
        const hasTokyo = searchTerms.some((t) => t.includes('tokyo'));
        const hasJapan = searchTerms.some((t) => t.includes('japan'));
        expect(hasTokyo).toBe(false);
        expect(hasJapan).toBe(false);
      }
      return Promise.resolve({ rows: [] });
    });

    await service.suggestInterests({
      title: 'Latte Art in Tokyo Japan at 35.6762, 139.6503',
      caption: 'Coffee shop meetup downtown near me #tokyo #japan #latteart',
      hashtags: ['#tokyo', '#coffee'],
      limit: 5,
    });

    expect(mockDatabaseService.query).toHaveBeenCalled();
  });
});

