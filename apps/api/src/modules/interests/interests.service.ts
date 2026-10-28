import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { getFlattenedTaxonomy, buildTaxonomyTree, computeVectorCentroid, normalizeVector, InterestTaxonomyNode, TopicPageDetails } from '@interest/shared';
import { CreateTopicDto } from './dto/select-interests.dto';

@Injectable()
export class InterestsService {
  private readonly logger = new Logger(InterestsService.name);
  private cachedTree: InterestTaxonomyNode[] | null = null;
  private cachedFlattened: any[] | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Seeds the database with the comprehensive 300+ interest taxonomy and 512-d unit vectors.
   */
  async seedTaxonomy(): Promise<{ seededCount: number }> {
    const flattened = getFlattenedTaxonomy();
    let count = 0;

    for (const node of flattened) {
      const vectorPg = DatabaseService.vectorToPg(node.vector);
      await this.databaseService.query(
        `INSERT INTO interests (id, slug, title, description, parent_id, level, icon, vector)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
         ON CONFLICT (slug) DO UPDATE
         SET title = EXCLUDED.title,
             description = EXCLUDED.description,
             vector = EXCLUDED.vector,
             level = EXCLUDED.level`,
        [
          node.id,
          node.slug,
          node.title,
          node.description,
          node.parentId || null,
          node.level,
          node.icon || null,
          vectorPg,
        ],
      );
      count++;
    }

    this.logger.log(`Seeded ${count} interest taxonomy nodes successfully.`);
    return { seededCount: count };
  }

  /**
   * Returns the complete hierarchical 3-level taxonomy tree.
   */
  async getTaxonomyTree(): Promise<InterestTaxonomyNode[]> {
    if (this.cachedTree) {
      return this.cachedTree;
    }

    try {
      const result = await this.databaseService.query(
        `SELECT id, slug, title, description, parent_id, level, icon, vector::text
         FROM interests
         ORDER BY level ASC, title ASC`,
      );

      if (result.rows.length === 0) {
        await this.seedTaxonomy();
        this.cachedTree = buildTaxonomyTree();
        return this.cachedTree;
      }

      const nodeMap = new Map<string, InterestTaxonomyNode>();
      const roots: InterestTaxonomyNode[] = [];

      for (const row of result.rows) {
        const node: InterestTaxonomyNode = {
          id: row.id,
          slug: row.slug,
          title: row.title,
          description: row.description,
          parentId: row.parent_id,
          level: row.level,
          icon: row.icon,
          vector: DatabaseService.pgToVector(row.vector),
          children: [],
        };
        nodeMap.set(node.id, node);
      }

      for (const node of nodeMap.values()) {
        if (node.parentId && nodeMap.has(node.parentId)) {
          nodeMap.get(node.parentId)!.children!.push(node);
        } else {
          roots.push(node);
        }
      }

      this.cachedTree = roots;
      return roots;
    } catch (err: any) {
      this.cachedTree = buildTaxonomyTree();
      return this.cachedTree;
    }
  }

  /**
   * Search interests across title, description, and slug with breadcrumb path.
   */
  async searchInterests(query: string, limit = 20) {
    if (!query || !query.trim()) {
      return [];
    }

    if (!this.cachedFlattened) {
      this.cachedFlattened = getFlattenedTaxonomy().map((n) => ({
        id: n.id,
        slug: n.slug,
        title: n.title,
        description: n.description,
        level: n.level,
        icon: n.icon,
        parentTitle: n.parentId,
      }));
    }

    try {
      const cleanQuery = `%${query.trim()}%`;
      const result = await this.databaseService.query(
        `SELECT i.id, i.slug, i.title, i.description, i.level, i.icon,
                p.title as parent_title
         FROM interests i
         LEFT JOIN interests p ON i.parent_id = p.id
         WHERE i.title ILIKE $1 OR i.description ILIKE $1 OR i.slug ILIKE $1
         ORDER BY i.level DESC, i.title ASC
         LIMIT $2`,
        [cleanQuery, limit],
      );

      return result.rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        level: row.level,
        icon: row.icon,
        parentTitle: row.parent_title,
      }));
    } catch (err: any) {
      const q = query.toLowerCase().trim();
      return this.cachedFlattened!
        .filter((node) => node.title.toLowerCase().includes(q) || node.slug.toLowerCase().includes(q))
        .slice(0, limit);
    }
  }

  /**
   * "More Like This" API:
   * Recommends related interests using pgvector cosine distance against the centroid of selected interests.
   */
  async getRelatedInterests(selectedIds: string[], limit = 6) {
    try {
      if (!selectedIds || selectedIds.length === 0) {
        // Return top diverse level-2 niches if none selected
        const result = await this.databaseService.query(
          `SELECT id, slug, title, description, level
           FROM interests
           WHERE level = 2
           ORDER BY RANDOM()
           LIMIT $1`,
          [limit],
        );
        return result.rows;
      }

      // 1. Fetch vectors for selected interests
      const selectedRes = await this.databaseService.query(
        `SELECT vector::text FROM interests WHERE id = ANY($1::uuid[])`,
        [selectedIds],
      );

      if (selectedRes.rows.length === 0) {
        return [];
      }

      const vectors = selectedRes.rows.map((r) => DatabaseService.pgToVector(r.vector));
      const centroid = computeVectorCentroid(vectors);
      const centroidPg = DatabaseService.vectorToPg(centroid);

      // 2. Query nearest unselected niche interests
      const query = `
        SELECT i.id, i.slug, i.title, i.description, i.level,
               1 - (i.vector <=> $1::vector) as similarity
        FROM interests i
        WHERE i.id != ALL($2::uuid[])
          AND i.level >= 1
        ORDER BY (i.vector <=> $1::vector) ASC
        LIMIT $3;
      `;

      const result = await this.databaseService.query(query, [centroidPg, selectedIds, limit]);
      return result.rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        level: row.level,
        similarityScore: parseFloat(row.similarity || 0),
      }));
    } catch (err: any) {
      this.logger.warn(`PostgreSQL unavailable, returning in-memory related interests fallback: ${err.message}`);
      return getFlattenedTaxonomy().slice(0, limit).map((n) => ({
        id: n.id,
        slug: n.slug,
        title: n.title,
        description: n.description,
        level: n.level,
        similarityScore: 0.88,
      }));
    }
  }

  /**
   * Assigns user onboarding interests (at least 5 required).
   */
  async selectInterests(userId: string, interestIds: string[]) {
    if (interestIds.length < 5 || interestIds.length > 15) {
      throw new BadRequestException('Please select between 5 and 15 niche interests.');
    }

    const interestsResult = await this.databaseService.query(
      `SELECT id, vector::text FROM interests WHERE id = ANY($1::uuid[])`,
      [interestIds],
    );

    if (interestsResult.rows.length !== interestIds.length) {
      throw new NotFoundException('One or more selected interests were not found.');
    }

    const vectors = interestsResult.rows.map((row) => DatabaseService.pgToVector(row.vector));
    const centroid = computeVectorCentroid(vectors);
    const centroidPg = DatabaseService.vectorToPg(centroid);

    const client = await this.databaseService.getClient();
    try {
      await client.query('BEGIN');

      // Update user interest centroid in PostgreSQL
      await client.query(
        `UPDATE users
         SET interest_vector = $1::vector,
             updated_at = NOW()
         WHERE id = $2`,
        [centroidPg, userId],
      );

      // Upsert user_interests with default affinity 1.0
      for (const id of interestIds) {
        await client.query(
          `INSERT INTO user_interests (user_id, interest_id, affinity_weight, is_muted, is_paused)
           VALUES ($1, $2, 1.0, FALSE, FALSE)
           ON CONFLICT (user_id, interest_id)
           DO UPDATE SET affinity_weight = 1.0, is_muted = FALSE, is_paused = FALSE, updated_at = NOW()`,
          [userId, id],
        );
      }

      await client.query('COMMIT');
      return { success: true, count: interestIds.length };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves user's active interests with weights, muted/paused status.
   */
  async getUserInterests(userId: string) {
    const result = await this.databaseService.query(
      `SELECT i.id, i.slug, i.title, i.description, i.level,
              ui.affinity_weight, ui.is_muted, ui.is_paused, ui.interaction_count
       FROM user_interests ui
       JOIN interests i ON ui.interest_id = i.id
       WHERE ui.user_id = $1
       ORDER BY ui.is_muted ASC, ui.affinity_weight DESC`,
      [userId],
    );

    return result.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      description: r.description,
      level: r.level,
      affinityWeight: parseFloat(r.affinity_weight),
      isMuted: r.is_muted,
      isPaused: r.is_paused,
      interactionCount: r.interaction_count,
    }));
  }

  /**
   * Adds a single interest to user's profile and recalculates centroid.
   */
  async addInterest(userId: string, interestId: string) {
    const interestRes = await this.databaseService.query(
      'SELECT id, vector::text FROM interests WHERE id = $1',
      [interestId],
    );

    if (interestRes.rows.length === 0) {
      throw new NotFoundException('Interest not found.');
    }

    await this.databaseService.query(
      `INSERT INTO user_interests (user_id, interest_id, affinity_weight, is_muted, is_paused)
       VALUES ($1, $2, 1.0, FALSE, FALSE)
       ON CONFLICT (user_id, interest_id)
       DO UPDATE SET is_muted = FALSE, updated_at = NOW()`,
      [userId, interestId],
    );

    await this.recalculateUserCentroid(userId);
    return { success: true };
  }

  /**
   * Removes an interest from user's profile.
   */
  async removeInterest(userId: string, interestId: string) {
    await this.databaseService.query(
      'DELETE FROM user_interests WHERE user_id = $1 AND interest_id = $2',
      [userId, interestId],
    );

    await this.recalculateUserCentroid(userId);
    return { success: true };
  }

  /**
   * Follows an interest (alias for addInterest).
   */
  async followInterest(userId: string, interestId: string) {
    return this.addInterest(userId, interestId);
  }

  /**
   * Unfollows an interest (alias for removeInterest).
   */
  async unfollowInterest(userId: string, interestId: string) {
    return this.removeInterest(userId, interestId);
  }

  /**
   * Toggles Mute state: Completely excludes topic from feed.
   * If not already in user_interests, upserts as muted so user can preemptively mute topic.
   */
  async toggleMute(userId: string, interestId: string, isMuted: boolean) {
    await this.databaseService.query(
      `INSERT INTO user_interests (user_id, interest_id, affinity_weight, is_muted, is_paused)
       VALUES ($1, $2, 1.0, $3, FALSE)
       ON CONFLICT (user_id, interest_id)
       DO UPDATE SET is_muted = $3, updated_at = NOW()`,
      [userId, interestId, isMuted],
    );

    await this.recalculateUserCentroid(userId);
    return { success: true, isMuted };
  }

  /**
   * Toggles Pause state: Freezes weight adaptation (no learning drift).
   */
  async togglePause(userId: string, interestId: string, isPaused: boolean) {
    const res = await this.databaseService.query(
      `UPDATE user_interests
       SET is_paused = $1, updated_at = NOW()
       WHERE user_id = $2 AND interest_id = $3`,
      [isPaused, userId, interestId],
    );

    if (res.rowCount === 0) {
      throw new NotFoundException('Interest not in user profile.');
    }

    return { success: true, isPaused };
  }

  /**
   * Topic Page Details API:
   * Aggregates hierarchy, breadcrumbs, subtopics, related interests, followers count,
   * viewer interaction status, and authorized top/recent reels.
   */
  async getTopicPage(idOrSlug: string, viewerId?: string | null): Promise<TopicPageDetails> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const topicRes = await this.databaseService.query(
      `SELECT id, slug, title, description, parent_id, level, icon, reels_count
       FROM interests
       WHERE ${isUuid ? 'id::text = $1 OR slug = $1' : 'slug = $1'}`,
      [idOrSlug],
    );

    if (topicRes.rows.length === 0) {
      throw new NotFoundException(`Topic "${idOrSlug}" not found.`);
    }

    const topic = topicRes.rows[0];

    // 1. Fetch parent details and build breadcrumbs
    let parentTitle: string | undefined;
    const breadcrumbs: { id: string; slug: string; title: string; level: number }[] = [
      { id: topic.id, slug: topic.slug, title: topic.title, level: topic.level },
    ];

    let currentParentId = topic.parent_id;
    while (currentParentId) {
      const pRes = await this.databaseService.query(
        'SELECT id, slug, title, parent_id, level FROM interests WHERE id = $1',
        [currentParentId],
      );
      if (pRes.rows.length === 0) break;
      const p = pRes.rows[0];
      if (!parentTitle && currentParentId === topic.parent_id) {
        parentTitle = p.title;
      }
      breadcrumbs.unshift({ id: p.id, slug: p.slug, title: p.title, level: p.level });
      currentParentId = p.parent_id;
    }

    // 2. Fetch direct subtopics
    const subtopicsRes = await this.databaseService.query(
      `SELECT id, slug, title, icon, reels_count
       FROM interests
       WHERE parent_id = $1
       ORDER BY reels_count DESC, title ASC`,
      [topic.id],
    );

    const subtopics = subtopicsRes.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      icon: r.icon || undefined,
      reelsCount: Number(r.reels_count || 0),
    }));

    // 3. Related interests
    const related = await this.getRelatedInterests([topic.id], 6);

    // 4. Followers count (users who have this interest active and unmuted)
    const followersRes = await this.databaseService.query(
      `SELECT COUNT(*)::int AS count FROM user_interests WHERE interest_id = $1 AND is_muted = FALSE`,
      [topic.id],
    );
    const followersCount = Number(followersRes.rows[0]?.count || 0);

    // 5. Viewer relationship
    let isFollowing = false;
    let isMuted = false;
    let isPaused = false;
    if (viewerId) {
      const viewerRes = await this.databaseService.query(
        `SELECT is_muted, is_paused FROM user_interests WHERE user_id = $1 AND interest_id = $2`,
        [viewerId, topic.id],
      );
      if (viewerRes.rows.length > 0) {
        isFollowing = true;
        isMuted = Boolean(viewerRes.rows[0].is_muted);
        isPaused = Boolean(viewerRes.rows[0].is_paused);
      }
    }

    // 6. Recent and Top reels for this topic (respecting blocks and visibility)
    const reelsBaseQuery = `
      SELECT
        r.id, r.creator_id, r.title, r.caption, r.transcript_text,
        r.thumbnail_url, r.hls_master_url, r.hashtags, r.view_count, r.like_count, r.comment_count, r.created_at,
        p.username AS creator_username, p.display_name AS creator_display_name, p.avatar_url AS creator_avatar_url
      FROM reels r
      INNER JOIN reel_interests ri ON ri.reel_id = r.id AND ri.interest_id = $1
      LEFT JOIN profiles p ON p.user_id = r.creator_id
      WHERE r.status = 'PUBLISHED'
        AND ($2::uuid IS NULL OR r.creator_id NOT IN (
          SELECT blocked_id FROM blocks WHERE blocker_id = $2::uuid
          UNION
          SELECT blocker_id FROM blocks WHERE blocked_id = $2::uuid
        ))
        AND (
          r.visibility = 'PUBLIC'
          OR ($2::uuid IS NOT NULL AND (
            r.creator_id = $2::uuid
            OR (r.visibility = 'FOLLOWERS_ONLY' AND EXISTS (
              SELECT 1 FROM follows f WHERE f.follower_id = $2::uuid AND f.following_id = r.creator_id AND f.status = 'ACCEPTED'
            ))
          ))
        )
    `;

    const recentRes = await this.databaseService.query(
      `${reelsBaseQuery} ORDER BY r.created_at DESC LIMIT 12;`,
      [topic.id, viewerId || null],
    );

    const topRes = await this.databaseService.query(
      `${reelsBaseQuery} ORDER BY (r.like_count * 2 + r.comment_count) DESC, r.view_count DESC LIMIT 12;`,
      [topic.id, viewerId || null],
    );

    const mapReel = (r: any) => ({
      id: r.id,
      title: r.title,
      caption: r.caption || undefined,
      transcriptText: r.transcript_text || undefined,
      thumbnailUrl: r.thumbnail_url || 'https://cdn.interest.app/placeholders/thumb.jpg',
      hlsMasterUrl: r.hls_master_url || 'https://cdn.interest.app/placeholders/stream.m3u8',
      creator: {
        id: r.creator_id,
        username: r.creator_username || 'creator',
        displayName: r.creator_display_name || 'Creator',
        avatarUrl: r.creator_avatar_url || undefined,
      },
      primaryInterest: {
        id: topic.id,
        title: topic.title,
      },
      hashtags: r.hashtags || [],
      viewCount: Number(r.view_count || 0),
      likeCount: Number(r.like_count || 0),
      commentCount: Number(r.comment_count || 0),
      textRelevanceScore: 1.0,
      interestMatchScore: 1.0,
      finalRankScore: 1.0,
    });

    return {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      description: topic.description || '',
      level: Number(topic.level),
      icon: topic.icon || undefined,
      parentId: topic.parent_id || undefined,
      parentTitle,
      breadcrumbs,
      subtopics,
      relatedInterests: related,
      reelsCount: Number(topic.reels_count || 0),
      followersCount,
      isFollowing,
      isMuted,
      isPaused,
      recentReels: recentRes.rows.map(mapReel),
      topReels: topRes.rows.map(mapReel),
    };
  }

  /**
   * Creates a new topic in the hierarchy with spam checks and duplicate prevention.
   */
  async createTopic(dto: CreateTopicDto) {
    const slug = dto.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
    const title = dto.title.trim();

    // 1. Spam & prohibited term check
    const prohibited = await this.databaseService.query(
      `SELECT term FROM prohibited_search_terms WHERE LOWER($1) LIKE '%' || LOWER(term) || '%' OR LOWER($2) LIKE '%' || LOWER(term) || '%'`,
      [title, slug],
    );
    if (prohibited.rows.length > 0) {
      throw new BadRequestException('Topic contains prohibited or spam terms under platform guidelines.');
    }

    // 2. Slug uniqueness
    const existingSlug = await this.databaseService.query('SELECT id FROM interests WHERE slug = $1', [slug]);
    if (existingSlug.rows.length > 0) {
      throw new BadRequestException(`A topic with slug "${slug}" already exists.`);
    }

    // 3. Parent validation and duplicate title under parent check
    let level = 0;
    let parentVectorPg: string | null = null;
    if (dto.parentId) {
      const parentRes = await this.databaseService.query(
        'SELECT id, level, vector::text FROM interests WHERE id = $1',
        [dto.parentId],
      );
      if (parentRes.rows.length === 0) {
        throw new NotFoundException('Parent category not found.');
      }
      level = Math.min(2, Number(parentRes.rows[0].level) + 1);
      parentVectorPg = parentRes.rows[0].vector;

      const dupTitle = await this.databaseService.query(
        'SELECT id FROM interests WHERE parent_id = $1 AND LOWER(title) = LOWER($2)',
        [dto.parentId, title],
      );
      if (dupTitle.rows.length > 0) {
        throw new BadRequestException(`A topic with title "${title}" already exists under this category.`);
      }
    } else {
      const dupRoot = await this.databaseService.query(
        'SELECT id FROM interests WHERE parent_id IS NULL AND LOWER(title) = LOWER($1)',
        [title],
      );
      if (dupRoot.rows.length > 0) {
        throw new BadRequestException(`A root category with title "${title}" already exists.`);
      }
    }

    // 4. Derive vector from parent or deterministic hash vector
    let unitVector: number[];
    if (parentVectorPg) {
      const parentVec = DatabaseService.pgToVector(parentVectorPg);
      unitVector = normalizeVector(parentVec.map((v, i) => (i % 7 === 0 ? v + 0.05 : v)));
    } else {
      const raw = Array.from({ length: 512 }, (_, i) => Math.sin(title.length + i));
      unitVector = normalizeVector(raw);
    }
    const vectorPg = DatabaseService.vectorToPg(unitVector);

    const insertRes = await this.databaseService.query(
      `INSERT INTO interests (slug, title, description, parent_id, level, icon, vector)
       VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
       RETURNING id, slug, title, description, parent_id, level, icon`,
      [slug, title, dto.description || '', dto.parentId || null, level, dto.icon || null, vectorPg],
    );

    return insertRes.rows[0];
  }

  /**
   * Helper: Recalculates user centroid from active, unmuted interests.
   */
  private async recalculateUserCentroid(userId: string) {
    const activeInterests = await this.databaseService.query(
      `SELECT i.vector::text, ui.affinity_weight
       FROM user_interests ui
       JOIN interests i ON ui.interest_id = i.id
       WHERE ui.user_id = $1 AND ui.is_muted = FALSE`,
      [userId],
    );

    if (!activeInterests || !activeInterests.rows || activeInterests.rows.length === 0) return;

    const weightedVectors: number[][] = [];
    for (const row of activeInterests.rows) {
      const vec = DatabaseService.pgToVector(row.vector);
      const weight = Math.max(0.1, parseFloat(row.affinity_weight || 1.0));
      weightedVectors.push(vec.map((val) => val * weight));
    }

    const centroid = computeVectorCentroid(weightedVectors);
    const centroidPg = DatabaseService.vectorToPg(centroid);

    await this.databaseService.query(
      'UPDATE users SET interest_vector = $1::vector, updated_at = NOW() WHERE id = $2',
      [centroidPg, userId],
    );
  }
}
