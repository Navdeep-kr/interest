import * as fs from 'fs';
import * as path from 'path';

describe('Prompt 22 — Database Migration Integrity & Invariant Linter', () => {
  const migrationsDir = path.join(__dirname, '../../src/database/migrations');

  let migrationFiles: string[];

  beforeAll(() => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();
  });

  it('verifies migrations are sequentially numbered without gaps or duplicates', () => {
    expect(migrationFiles.length).toBeGreaterThanOrEqual(27);

    const extractedNumbers = migrationFiles.map((file) => {
      const match = file.match(/^(\d{3})_/);
      expect(match).not.toBeNull();
      return parseInt(match![1], 10);
    });

    // Check strict 1 to N sequential order
    for (let i = 0; i < extractedNumbers.length; i++) {
      expect(extractedNumbers[i]).toBe(i + 1);
    }
  });

  it('enforces Zero-Location architectural invariant across all SQL migrations', () => {
    const forbiddenLocationKeywords = [
      /\blatitude\b/i,
      /\blongitude\b/i,
      /\bgeo_point\b/i,
      /\bgeography\b/i,
      /\bpostgis\b/i,
      /\buser_location\b/i,
      /\bdevice_ip_address\b/i,
      /\bexact_coordinates\b/i,
    ];

    for (const file of migrationFiles) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      // Strip SQL line comments (-- ...) and block comments (/* ... */)
      const cleanContent = content
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');

      for (const pattern of forbiddenLocationKeywords) {
        const hasViolation = pattern.test(cleanContent);
        if (hasViolation) {
          throw new Error(
            `Zero-Location Violation: Migration file [${file}] contains forbidden spatial/location pattern: ${pattern}`,
          );
        }
      }
    }
  });

  it('verifies idempotent DDL patterns (IF NOT EXISTS) in schema extensions', () => {
    // Migrations 002 to 027 should use IF NOT EXISTS or guarded ALTER TABLE
    for (let i = 1; i < migrationFiles.length; i++) {
      const file = migrationFiles[i];
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      // Check for table creation idempotency
      if (content.includes('CREATE TABLE')) {
        expect(content).toMatch(/CREATE TABLE (IF NOT EXISTS)/i);
      }

      // Check for index creation idempotency
      if (content.includes('CREATE INDEX')) {
        expect(content).toMatch(/CREATE INDEX (IF NOT EXISTS)/i);
      }
    }
  });

  it('verifies foreign key constraints declare explicit ON DELETE behavior for cascade safety', () => {
    for (const file of migrationFiles) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      const fkMatches = content.match(/REFERENCES\s+([a-zA-Z0-9_]+)\s*\([a-zA-Z0-9_]+\)/gi);
      if (fkMatches && fkMatches.length > 0) {
        // Migration should define ON DELETE CASCADE / SET NULL / RESTRICT
        const hasOnDelete = /ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION)/i.test(content);
        expect(hasOnDelete).toBe(true);
      }
    }
  });
});
