import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('CI Guard: Zero-Location Architectural Enforcement', () => {
  const rootDir = path.resolve(__dirname, '../../../../');
  const scriptPath = path.join(rootDir, 'scripts', 'verify-zero-location.js');
  const testIllicitFilePath = path.join(
    rootDir,
    'apps',
    'api',
    'src',
    'modules',
    'feed',
    '__illicit_test_probe.ts',
  );

  afterEach(() => {
    if (fs.existsSync(testIllicitFilePath)) {
      fs.unlinkSync(testIllicitFilePath);
    }
  });

  it('should pass cleanly on the existing production codebase', () => {
    const output = execSync(`node "${scriptPath}"`, {
      cwd: rootDir,
      encoding: 'utf8',
    });

    expect(output).toContain('ZERO-LOCATION AUDIT PASSED');
    expect(output).toContain('Recommendation engine is 100% geo-blind');
  });

  it('should fail with exit code 1 when forbidden location package is imported', () => {
    // Inject forbidden import in feed directory
    fs.writeFileSync(
      testIllicitFilePath,
      `import geoip from 'geoip-lite';\nexport const probe = geoip;\n`,
    );

    let failed = false;
    try {
      execSync(`node "${scriptPath}"`, {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (err: any) {
      failed = true;
      expect(err.status).toBe(1);
      const stderr = err.stderr?.toString() || err.stdout?.toString();
      expect(stderr).toContain('ZERO-LOCATION ARCHITECTURAL VIOLATIONS DETECTED');
      expect(stderr).toContain('geoip-lite');
    }

    expect(failed).toBe(true);
  });

  it('should fail with exit code 1 when forbidden location ranking field is referenced', () => {
    // Inject forbidden SQL column in feed directory
    fs.writeFileSync(
      testIllicitFilePath,
      `export function getRank() {\n  return "SELECT * FROM reels WHERE country_code = 'US'";\n}\n`,
    );

    let failed = false;
    try {
      execSync(`node "${scriptPath}"`, {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (err: any) {
      failed = true;
      expect(err.status).toBe(1);
      const stderr = err.stderr?.toString() || err.stdout?.toString();
      expect(stderr).toContain('Forbidden location token: "country_code"');
    }

    expect(failed).toBe(true);
  });
});
