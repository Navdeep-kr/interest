import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { generateDeterministicUnitVector } from '@shared/vector-math';
import { stripGeoEntities } from '@shared/geo-sanitizer';
import { SuggestInterestsDto, SuggestedInterestItem } from '@shared/types';

@Injectable()
export class AiInterestSuggesterService {
  private readonly logger = new Logger(AiInterestSuggesterService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Auto-suggests relevant interest taxonomy tags based on video title, caption, and hashtags.
   * Employs vector semantic similarity combined with lexical domain concept extraction.
   * HARD GUARANTEE: All location terms and coordinates are stripped prior to feature extraction.
   */
  async suggestInterests(dto: SuggestInterestsDto): Promise<SuggestedInterestItem[]> {
    const limit = dto.limit || 5;
    const rawCorpus = [
      dto.title,
      dto.caption || '',
      ...(dto.hashtags || []).map((h) => h.replace(/^#/, '')),
    ]
      .join(' ')
      .trim();

    // Zero-Location Guarantee: Strip geographic names, coordinates, and geo-hashtags
    const textCorpus = stripGeoEntities(rawCorpus).toLowerCase();

    if (!textCorpus) {
      return [];
    }

    // 1. Generate 512-d semantic content vector
    const contentVector = generateDeterministicUnitVector(textCorpus);
    const contentVectorPg = DatabaseService.vectorToPg(contentVector);

    // 2. Query nearest taxonomy nodes via pgvector cosine distance
    const vectorCandidatesRes = await this.databaseService.query(
      `SELECT i.id, i.slug, i.title, i.description, i.level,
              p.title as parent_title,
              1 - (i.vector <=> $1::vector) as vector_similarity
       FROM interests i
       LEFT JOIN interests p ON i.parent_id = p.id
       WHERE i.level >= 1
       ORDER BY (i.vector <=> $1::vector) ASC
       LIMIT 30;`,
      [contentVectorPg],
    );

    // 3. Query direct lexical matches across title and description
    const words = textCorpus
      .split(/[\s,._-]+/)
      .filter((w) => w.length > 2)
      .slice(0, 10);

    let lexicalRows: any[] = [];
    if (words.length > 0) {
      const searchTerms = words.map((w) => `%${w}%`);
      const lexicalRes = await this.databaseService.query(
        `SELECT i.id, i.slug, i.title, i.description, i.level,
                p.title as parent_title
         FROM interests i
         LEFT JOIN interests p ON i.parent_id = p.id
         WHERE i.level >= 1 AND (i.title ILIKE ANY($1) OR i.slug ILIKE ANY($1))
         LIMIT 20;`,
        [searchTerms],
      );
      lexicalRows = lexicalRes.rows;
    }

    // 4. Merge and score candidates
    const candidateMap = new Map<string, SuggestedInterestItem>();

    // Process lexical exact/partial matches first
    for (const row of lexicalRows) {
      let lexicalMatchScore = 0.85;
      if (textCorpus.includes(row.title.toLowerCase()) || textCorpus.includes(row.slug.toLowerCase())) {
        lexicalMatchScore = 0.96;
      }

      candidateMap.set(row.id, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        confidenceScore: lexicalMatchScore,
        parentTitle: row.parent_title,
      });
    }

    // Blend vector similarity candidates
    for (const row of vectorCandidatesRes.rows) {
      const sim = parseFloat(row.vector_similarity || 0);
      const existing = candidateMap.get(row.id);

      if (existing) {
        // Boost confidence if both vector and lexical agree
        existing.confidenceScore = Math.min(0.99, Number((existing.confidenceScore * 0.6 + sim * 0.4).toFixed(2)));
      } else {
        const titleWords = row.title.toLowerCase().split(/\s+/);
        const hasKeywordOverlap = titleWords.some((tw: string) => textCorpus.includes(tw));
        const finalScore = hasKeywordOverlap ? Math.min(0.95, sim + 0.15) : sim;

        candidateMap.set(row.id, {
          id: row.id,
          slug: row.slug,
          title: row.title,
          description: row.description,
          confidenceScore: Number(finalScore.toFixed(2)),
          parentTitle: row.parent_title,
        });
      }
    }

    // 5. Rank candidates by confidence score and return top-k
    const sorted = Array.from(candidateMap.values())
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, limit);

    this.logger.log(
      `Suggested ${sorted.length} interest tags for "${dto.title}" with top confidence: ${sorted[0]?.confidenceScore || 0}`,
    );

    return sorted;
  }
}
