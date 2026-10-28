import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface CopyrightCheckResult {
  matched: boolean;
  matchScore: number; // 0.0 to 1.0
  track?: {
    id: string;
    title: string;
    artist: string;
    rightsHolder: string;
    audioFingerprint: string;
    allowedForRemix: boolean;
  };
}

@Injectable()
export class CopyrightService {
  private readonly logger = new Logger(CopyrightService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Scans an audio fingerprint against the protected acoustic registry.
   */
  async checkAudioFingerprint(
    fingerprint?: string,
    simulatedMetadata?: { title?: string; artist?: string },
  ): Promise<CopyrightCheckResult> {
    if (!fingerprint && !simulatedMetadata?.title) {
      return { matched: false, matchScore: 0.0 };
    }

    try {
      // 1. Direct fingerprint match
      if (fingerprint) {
        const res = await this.databaseService.query(
          `SELECT id, title, artist, rights_holder, audio_fingerprint, allowed_for_remix
           FROM copyrighted_audio_registry
           WHERE audio_fingerprint = $1
           LIMIT 1`,
          [fingerprint],
        );

        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            matched: true,
            matchScore: 0.99,
            track: {
              id: row.id,
              title: row.title,
              artist: row.artist,
              rightsHolder: row.rights_holder,
              audioFingerprint: row.audio_fingerprint,
              allowedForRemix: row.allowed_for_remix,
            },
          };
        }
      }

      // 2. Fuzzy metadata / acoustic matching check
      if (simulatedMetadata?.title) {
        const query = `
          SELECT id, title, artist, rights_holder, audio_fingerprint, allowed_for_remix
          FROM copyrighted_audio_registry
          WHERE LOWER(title) = LOWER($1)
             OR (artist IS NOT NULL AND LOWER(artist) = LOWER($2))
          LIMIT 1
        `;
        const res = await this.databaseService.query(query, [
          simulatedMetadata.title.trim(),
          simulatedMetadata.artist?.trim() || '',
        ]);

        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            matched: true,
            matchScore: 0.95,
            track: {
              id: row.id,
              title: row.title,
              artist: row.artist,
              rightsHolder: row.rights_holder,
              audioFingerprint: row.audio_fingerprint,
              allowedForRemix: row.allowed_for_remix,
            },
          };
        }
      }

      return { matched: false, matchScore: 0.0 };
    } catch (err: any) {
      this.logger.error(`Copyright check error: ${err.message}`);
      return { matched: false, matchScore: 0.0 };
    }
  }

  /**
   * Registers a new copyrighted track into the reference registry.
   */
  async registerProtectedTrack(data: {
    title: string;
    artist: string;
    rightsHolder: string;
    audioFingerprint: string;
    allowedForRemix?: boolean;
  }) {
    const res = await this.databaseService.query(
      `INSERT INTO copyrighted_audio_registry
        (title, artist, rights_holder, audio_fingerprint, allowed_for_remix)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (audio_fingerprint) DO UPDATE
       SET title = EXCLUDED.title,
           artist = EXCLUDED.artist,
           rights_holder = EXCLUDED.rights_holder,
           allowed_for_remix = EXCLUDED.allowed_for_remix
       RETURNING *`,
      [
        data.title,
        data.artist,
        data.rightsHolder,
        data.audioFingerprint,
        data.allowedForRemix || false,
      ],
    );
    return res.rows[0];
  }
}
