#!/usr/bin/env node

/**
 * Skipped Tests Enforcer Policy Checker
 * Prompt 22 Requirement: "Mark skipped tests BLOCKED, not passed."
 *
 * Scans backend and Flutter test files for test skipping patterns:
 * - it.skip, test.skip, describe.skip, xit(, xdescribe(
 * - skip: true, skip: '...'
 *
 * Fails closed (exit code 1) if any skipped test is detected.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const TEST_DIRECTORIES = [
  path.join(ROOT_DIR, 'apps', 'api', 'test'),
  path.join(ROOT_DIR, 'apps', 'mobile_flutter', 'test'),
];

const SKIPPED_PATTERNS = [
  { regex: /\b(it|test|describe)\.skip\s*\(/g, name: '.skip() method' },
  { regex: /\b(xit|xdescribe)\s*\(/g, name: 'x-disabled test (xit/xdescribe)' },
  { regex: /\bskip\s*:\s*(true|['"][^'"]*['"])/g, name: 'Dart skip parameter' },
];

let totalViolations = 0;
const violationsList = [];

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        scanDirectory(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.e2e-spec.ts') || entry.name.endsWith('_test.dart'))) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // Skip comment lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    for (const pattern of SKIPPED_PATTERNS) {
      if (pattern.regex.test(line)) {
        totalViolations++;
        violationsList.push({
          file: path.relative(ROOT_DIR, filePath),
          line: index + 1,
          pattern: pattern.name,
          snippet: trimmed,
        });
      }
    }
  });
}

console.log('=================================================================');
console.log('   CI/CD Release Gate: Skipped Tests Enforcer Policy Scan        ');
console.log('=================================================================\n');

for (const dir of TEST_DIRECTORIES) {
  scanDirectory(dir);
}

if (totalViolations > 0) {
  console.error(`\x1b[31m[GATE BLOCKED] Found ${totalViolations} skipped test(s) in codebase!\x1b[0m`);
  console.error('\x1b[33mPolicy Violation: Skipped tests are prohibited in release gates.\x1b[0m');
  console.error('All tests must be either fixed to pass or explicitly resolved.\n');

  violationsList.forEach((v) => {
    console.error(`  - ${v.file}:${v.line} [${v.pattern}]`);
    console.error(`    Code: ${v.snippet}`);
  });

  console.error('\n\x1b[31mRelease Pipeline Status: BLOCKED\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m[PASS] Zero skipped tests detected across all test suites.\x1b[0m');
  console.log('All tests are active and participating in the release gate.');
  process.exit(0);
}
