#!/usr/bin/env node

/**
 * ============================================================================
 * "INTEREST" ZERO-LOCATION ARCHITECTURAL CI GUARD
 * ============================================================================
 * Core Principle: Feed ranking, candidate retrieval, and interest embeddings
 * must NEVER import, query, or factor in geographic location, GPS, IP origin,
 * city, or proximity.
 *
 * This script runs in CI before tests or builds.
 * It scans all feed, recommendation, telemetry, and content ranking code.
 * If ANY prohibited package import or location identifier is detected,
 * it immediately fails the build with exit code 1.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Subsystems strictly governed by the Zero-Location guarantee
const TARGET_DIRS = [
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'feed'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'interests'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'reels'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'telemetry'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'creator'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'search'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'chat'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'safety'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'notifications'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'monetization'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'analytics'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'experiments'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'compliance'),
  path.join(ROOT_DIR, 'apps', 'api', 'src', 'modules', 'social-importer'),
  path.join(ROOT_DIR, 'packages', 'shared', 'src'),
];

// Optional: Scan mobile code for location permission requests
const MOBILE_DIR = path.join(ROOT_DIR, 'apps', 'mobile');
const FLUTTER_DIR = path.join(ROOT_DIR, 'apps', 'mobile_flutter');

// Prohibited libraries & modules (any import/require in ranking code fails build)
const FORBIDDEN_PACKAGES = [
  'geoip-lite',
  'geoip',
  'fast-geoip',
  'maxmind',
  '@maxmind/geoip2-node',
  '@mapbox',
  'node-geocoder',
  'geolib',
  'ip-location',
  'expo-location',
  '@react-native-community/geolocation',
  'google-maps',
  '@googlemaps',
];

// Prohibited geographic field names and tokens in ranking/feed code
const FORBIDDEN_TOKENS = [
  { pattern: /\bcountry_code\b/i, name: 'country_code' },
  { pattern: /\buser_country\b/i, name: 'user_country' },
  { pattern: /\bdevice_country\b/i, name: 'device_country' },
  { pattern: /\bip_country\b/i, name: 'ip_country' },
  { pattern: /\biso_country\b/i, name: 'iso_country' },
  { pattern: /\blatitude\b/i, name: 'latitude' },
  { pattern: /\blongitude\b/i, name: 'longitude' },
  { pattern: /\bgps_coordinates\b/i, name: 'gps_coordinates' },
  { pattern: /\bproximity_km\b/i, name: 'proximity_km' },
  { pattern: /\bradius_km\b/i, name: 'radius_km' },
  { pattern: /\bgeofence\b/i, name: 'geofence' },
  { pattern: /\bdistance_km\b/i, name: 'distance_km' },
  { pattern: /\bST_DWithin\b/i, name: 'ST_DWithin (PostGIS spatial query)' },
  { pattern: /\bST_Distance\b/i, name: 'ST_Distance (PostGIS spatial query)' },
  { pattern: /\brequest\.ip\b/i, name: 'request.ip access in ranking logic' },
  { pattern: /\breq\.ip\b/i, name: 'req.ip access in ranking logic' },
];

// Prohibited Android / iOS location permissions in mobile app
const FORBIDDEN_MOBILE_PERMISSIONS = [
  'ACCESS_FINE_LOCATION',
  'ACCESS_COARSE_LOCATION',
  'ACCESS_BACKGROUND_LOCATION',
  'requestForegroundPermissionsAsync',
  'requestBackgroundPermissionsAsync',
];

let totalFilesChecked = 0;
const violations = [];

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        getAllFiles(fullPath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx') || file.endsWith('.dart') || file.endsWith('.xml')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

console.log('\n=============================================================');
console.log('   INTEREST CI: ZERO-LOCATION ARCHITECTURAL ENFORCEMENT');
console.log('=============================================================\n');
console.log('Target directories to audit:');
TARGET_DIRS.forEach((d) => console.log(`  - ${path.relative(ROOT_DIR, d)}`));
console.log('');

// 1. Audit API & Shared Recommendation Subsystems
for (const dir of TARGET_DIRS) {
  const files = getAllFiles(dir);
  for (const filePath of files) {
    // We audit implementation files. Test specs (*.spec.ts) are allowed to test
    // adversarial geo-stripping and mocking unless they import forbidden packages.
    const isSpec = filePath.endsWith('.spec.ts') || filePath.endsWith('.test.ts');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    totalFilesChecked++;

    lines.forEach((line, lineIndex) => {
      const lineNum = lineIndex + 1;
      const trimmed = line.trim();

      // Skip single line comments explaining zero-location policy
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return;
      }

      // Check 1: Forbidden package imports
      for (const pkg of FORBIDDEN_PACKAGES) {
        const importPattern = new RegExp(
          `(from\\s+['"]${pkg}['"]|require\\(['"]${pkg}['"]\\))`,
          'i',
        );
        if (importPattern.test(line)) {
          violations.push({
            file: path.relative(ROOT_DIR, filePath),
            line: lineNum,
            rule: `Forbidden location package dependency: "${pkg}"`,
            codeSnippet: trimmed,
          });
        }
      }

      // Check 2: Forbidden location tokens in implementation files
      if (!isSpec) {
        // Exclude geo-sanitizer itself since it defines lists of terms to strip
        if (filePath.includes('geo-sanitizer')) {
          return;
        }

        for (const token of FORBIDDEN_TOKENS) {
          if (token.pattern.test(line)) {
            violations.push({
              file: path.relative(ROOT_DIR, filePath),
              line: lineNum,
              rule: `Forbidden location token: "${token.name}"`,
              codeSnippet: trimmed,
            });
          }
        }
      }
    });
  }
}

// 2. Audit Mobile Permissions (Prevent Location Permission Declarations)
const mobileDirs = [MOBILE_DIR, FLUTTER_DIR].filter((d) => fs.existsSync(d));
for (const mDir of mobileDirs) {
  const mobileFiles = getAllFiles(mDir);
  for (const filePath of mobileFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, lineIndex) => {
      const lineNum = lineIndex + 1;
      const trimmed = line.trim();

      // Skip lines that explicitly remove/block permissions
      if (trimmed.includes('tools:node="remove"') || trimmed.includes('blockedPermissions')) {
        return;
      }

      for (const perm of FORBIDDEN_MOBILE_PERMISSIONS) {
        if (line.includes(perm)) {
          violations.push({
            file: path.relative(ROOT_DIR, filePath),
            line: lineNum,
            rule: `Prohibited mobile location permission/API call: "${perm}"`,
            codeSnippet: trimmed,
          });
        }
      }
    });
  }
}

// 3. Output Findings
if (violations.length > 0) {
  console.error('\n❌ ZERO-LOCATION ARCHITECTURAL VIOLATIONS DETECTED!');
  console.error(`Found ${violations.length} fatal violation(s) across audited code:\n`);

  violations.forEach((v, index) => {
    console.error(`  [${index + 1}] File: ${v.file}:${v.line}`);
    console.error(`      Rule:   ${v.rule}`);
    console.error(`      Source: ${v.codeSnippet}\n`);
  });

  console.error('-------------------------------------------------------------');
  console.error('BUILD FAILED: Location data or dependencies are strictly forbidden');
  console.error('in Interest feed ranking, telemetry, and recommendation pipelines.');
  console.error('-------------------------------------------------------------\n');
  process.exit(1);
} else {
  console.log(`✅ ZERO-LOCATION AUDIT PASSED!`);
  console.log(`Audited ${totalFilesChecked} files across ranking, feed, telemetry, and mobile.`);
  console.log('Zero prohibited location libraries or ranking coordinates detected.');
  console.log('Recommendation engine is 100% geo-blind.\n');
  process.exit(0);
}
