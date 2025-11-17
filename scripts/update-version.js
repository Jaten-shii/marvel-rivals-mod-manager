#!/usr/bin/env node

/**
 * Automated Version Management Script
 *
 * Updates version across all files in the project:
 * - package.json
 * - src-tauri/tauri.conf.json (controls installer version)
 * - src/shared/constants.ts
 *
 * Usage:
 *   node scripts/update-version.js patch   (1.0.0 -> 1.0.1)
 *   node scripts/update-version.js minor   (1.0.0 -> 1.1.0)
 *   node scripts/update-version.js major   (1.0.0 -> 2.0.0)
 *   node scripts/update-version.js 2.5.3   (set specific version)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Files that need version updates
const FILES = {
  packageJson: join(rootDir, 'package.json'),
  tauriConfig: join(rootDir, 'src-tauri', 'tauri.conf.json'),
  constants: join(rootDir, 'src', 'shared', 'constants.ts'),
};

function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync(FILES.packageJson, 'utf-8'));
  return pkg.version;
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Invalid version format: ${version}`);
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
  };
}

function incrementVersion(current, type) {
  const { major, minor, patch } = parseVersion(current);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }
}

function updatePackageJson(newVersion) {
  const content = readFileSync(FILES.packageJson, 'utf-8');
  const pkg = JSON.parse(content);
  pkg.version = newVersion;
  writeFileSync(FILES.packageJson, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log(`✓ Updated package.json → ${newVersion}`);
}

function updateTauriConfig(newVersion) {
  const content = readFileSync(FILES.tauriConfig, 'utf-8');
  const updated = content.replace(
    /"version":\s*"[^"]+"/,
    `"version": "${newVersion}"`
  );
  writeFileSync(FILES.tauriConfig, updated, 'utf-8');
  console.log(`✓ Updated src-tauri/tauri.conf.json → ${newVersion}`);
}

function updateConstants(newVersion) {
  const content = readFileSync(FILES.constants, 'utf-8');
  const updated = content.replace(
    /export const APP_VERSION = ['"][^'"]+['"]/,
    `export const APP_VERSION = '${newVersion}'`
  );
  writeFileSync(FILES.constants, updated, 'utf-8');
  console.log(`✓ Updated src/shared/constants.ts → ${newVersion}`);
}

function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.error('❌ Error: Version type or number required');
    console.error('Usage: node scripts/update-version.js [patch|minor|major|x.y.z]');
    process.exit(1);
  }

  const currentVersion = getCurrentVersion();
  console.log(`\nCurrent version: ${currentVersion}`);

  let newVersion;

  // Check if argument is a specific version number
  if (/^\d+\.\d+\.\d+$/.test(arg)) {
    newVersion = arg;
  } else if (['patch', 'minor', 'major'].includes(arg)) {
    newVersion = incrementVersion(currentVersion, arg);
  } else {
    console.error(`❌ Error: Invalid argument "${arg}"`);
    console.error('Must be "patch", "minor", "major", or a version number (e.g., "2.5.3")');
    process.exit(1);
  }

  console.log(`New version: ${newVersion}\n`);

  try {
    updatePackageJson(newVersion);
    updateTauriConfig(newVersion);
    updateConstants(newVersion);

    console.log(`\n✅ Successfully updated all files to version ${newVersion}!`);
    console.log('\nNext steps:');
    console.log('  1. Review changes: git diff');
    console.log('  2. Build release: pnpm run prebuild && pnpm run build');
    console.log('  3. Commit changes: git add . && git commit -m "Release v' + newVersion + '"');
  } catch (error) {
    console.error(`\n❌ Error updating version: ${error.message}`);
    process.exit(1);
  }
}

main();
