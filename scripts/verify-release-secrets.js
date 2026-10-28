#!/usr/bin/env node

/**
 * Release Build Secret Injection Validator
 * Prompt 22 Requirement: "Configure pull-request gates, artifact retention and secret injection."
 *
 * Verifies that required environment secrets exist and are non-empty before initiating
 * release builds, without exposing secret values in build logs.
 */

const REQUIRED_RELEASE_SECRETS = [
  { name: 'DATABASE_URL', critical: true },
  { name: 'REDIS_HOST', critical: true },
  { name: 'JWT_SECRET', critical: true },
  { name: 'STRIPE_WEBHOOK_SECRET', critical: true },
  { name: 'KEYSTORE_PASSWORD', critical: false, androidSigning: true },
  { name: 'KEY_ALIAS', critical: false, androidSigning: true },
  { name: 'KEY_PASSWORD', critical: false, androidSigning: true },
];

const INSECURE_PATTERNS = [
  'changeme',
  'password123',
  'secret',
  'placeholder',
  'your-secret-here',
];

console.log('=================================================================');
console.log('   CI/CD Release Gate: Secret Injection & Integrity Check        ');
console.log('=================================================================\n');

const isReleaseBuild = process.env.RELEASE_BUILD === 'true' || process.env.GITHUB_REF?.includes('tags/');
let missingCriticalCount = 0;
let insecureCount = 0;

REQUIRED_RELEASE_SECRETS.forEach((sec) => {
  const value = process.env[sec.name];
  const isPresent = value && value.trim().length > 0;

  if (!isPresent) {
    if (sec.critical || isReleaseBuild) {
      console.error(`\x1b[31m[MISSING] Secret [${sec.name}] is not set.\x1b[0m`);
      missingCriticalCount++;
    } else {
      console.warn(`\x1b[33m[OPTIONAL] Secret [${sec.name}] is not set (non-release build).\x1b[0m`);
    }
  } else {
    // Check for insecure placeholders
    const isWeak = INSECURE_PATTERNS.some((p) => value.toLowerCase().includes(p));
    if (isWeak && isReleaseBuild) {
      console.error(`\x1b[31m[INSECURE] Secret [${sec.name}] contains weak/placeholder pattern.\x1b[0m`);
      insecureCount++;
    } else {
      console.log(`\x1b[32m[INJECTED] Secret [${sec.name}] is present (${value.length} characters).\x1b[0m`);
    }
  }
});

if (missingCriticalCount > 0 || insecureCount > 0) {
  console.error(`\n\x1b[31m[GATE BLOCKED] Secret validation failed! (${missingCriticalCount} missing, ${insecureCount} weak)\x1b[0m`);
  console.error('Release builds cannot proceed without authenticated, secure environment secrets.');
  process.exit(1);
} else {
  console.log('\n\x1b[32m[PASS] All required release secrets verified successfully.\x1b[0m');
  process.exit(0);
}
