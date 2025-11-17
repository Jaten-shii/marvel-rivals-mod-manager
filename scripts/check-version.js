#!/usr/bin/env node

/**
 * Version Consistency Checker
 *
 * Verifies that version numbers are synchronized across all project files:
 * - package.json
 * - src-tauri/tauri.conf.json (controls installer version)
 * - src/shared/constants.ts
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Files to check
const FILES = {
  packageJson: join(rootDir, 'package.json'),
  tauriConfig: join(rootDir, 'src-tauri', 'tauri.conf.json'),
  constants: join(rootDir, 'src', 'shared', 'constants.ts'),
};

function getPackageVersion() {
  const pkg = JSON.parse(readFileSync(FILES.packageJson, 'utf-8'));
  return pkg.version;
}

function getTauriVersion() {
  const content = readFileSync(FILES.tauriConfig, 'utf-8');
  const match = content.match(/"version":\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function getConstantsVersion() {
  const content = readFileSync(FILES.constants, 'utf-8');
  const match = content.match(/export const APP_VERSION = ['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

function main() {
  console.log('\n🔍 Checking version consistency...\n');

  const versions = {
    'package.json': getPackageVersion(),
    'src-tauri/tauri.conf.json': getTauriVersion(),
    'src/shared/constants.ts': getConstantsVersion(),
  };

  // Display all versions
  let allMatch = true;
  const expectedVersion = versions['package.json'];

  for (const [file, version] of Object.entries(versions)) {
    const status = version === expectedVersion ? '✅' : '❌';
    const versionDisplay = version || 'NOT FOUND';
    console.log(`${status} ${file}: ${versionDisplay}`);

    if (version !== expectedVersion) {
      allMatch = false;
    }
  }

  console.log('');

  if (allMatch) {
    console.log(`✅ All versions are synchronized at ${expectedVersion}`);
    process.exit(0);
  } else {
    console.error(`❌ Version mismatch detected!`);
    console.error(`\nExpected version: ${expectedVersion}`);
    console.error(`Run one of the following to fix:\n`);
    console.error(`  pnpm run version:patch   # Increment patch (${expectedVersion} → x.x.${parseInt(expectedVersion.split('.')[2]) + 1})`);
    console.error(`  pnpm run version:minor   # Increment minor (${expectedVersion} → x.${parseInt(expectedVersion.split('.')[1]) + 1}.0)`);
    console.error(`  pnpm run version:major   # Increment major (${expectedVersion} → ${parseInt(expectedVersion.split('.')[0]) + 1}.0.0)`);
    console.error(`  node scripts/update-version.js ${expectedVersion}   # Set all to ${expectedVersion}\n`);
    process.exit(1);
  }
}

main();
