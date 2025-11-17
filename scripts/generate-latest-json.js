#!/usr/bin/env node

/**
 * Automatic latest.json Generator
 *
 * Generates the latest.json file for Tauri auto-updates after building.
 * Reads the signature from the .sig file and creates a properly formatted update manifest.
 *
 * Usage:
 *   node scripts/generate-latest-json.js [release-notes]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Get version from package.json
function getVersion() {
  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  return pkg.version;
}

// Read signature from .sig file
function getSignature(version) {
  const sigPath = join(
    rootDir,
    'src-tauri',
    'target',
    'release',
    'bundle',
    'nsis',
    `Marvel-Rivals-Mod-Manager_${version}_x64-setup.exe.sig`
  );

  if (!existsSync(sigPath)) {
    console.error(`❌ Signature file not found: ${sigPath}`);
    console.error('Make sure you run `pnpm tauri build` first!');
    process.exit(1);
  }

  return readFileSync(sigPath, 'utf-8').trim();
}

// Generate release notes
function generateReleaseNotes(version) {
  const customNotes = process.argv[2];

  if (customNotes) {
    return customNotes;
  }

  // v3.1.0 specific release notes
  if (version === '3.1.0') {
    return `# Marvel Rivals Mod Manager v3.1.0

## New Features
- 🌐 Browse NexusMods button for discovering new mods
- 📏 Enhanced mod selection dialog (larger, better UX)
- 🗑️ Custom delete confirmation dialog

## Bug Fixes
- Fixed thumbnail crop bounds error
- Fixed mod card blur when adding new mods
- Fixed delete timing issue

## Content Updates
- Added missing costumes for Angela and Black Widow

See full release notes on GitHub!`;
  }

  // Default release notes template
  return `# Marvel Rivals Mod Manager v${version}\n\n## What's New\n\nSee full release notes on GitHub!\n\n## Installation\n- Download and run the installer\n- Existing users will receive automatic update notifications`;
}

// Generate latest.json
function generateLatestJson() {
  console.log('\n🔧 Generating latest.json...\n');

  const version = getVersion();
  const versionTag = `v${version}`;

  console.log(`📦 Version: ${versionTag}`);

  const signature = getSignature(version);
  console.log(`🔐 Signature: ${signature.substring(0, 50)}...`);

  const releaseNotes = generateReleaseNotes(version);

  const currentDate = new Date().toISOString();

  const latestJson = {
    version: versionTag,
    notes: releaseNotes,
    pub_date: currentDate,
    platforms: {
      'windows-x86_64': {
        signature: signature,
        url: `https://github.com/Jaten-shii/marvel-rivals-mod-manager/releases/download/${versionTag}/Marvel-Rivals-Mod-Manager_${version}_x64-setup.exe`
      }
    }
  };

  // Write to build output directory
  const outputPath = join(
    rootDir,
    'src-tauri',
    'target',
    'release',
    'bundle',
    'nsis',
    'latest.json'
  );

  writeFileSync(outputPath, JSON.stringify(latestJson, null, 2) + '\n', 'utf-8');
  console.log(`✅ Generated: ${outputPath}`);

  // Also write to project root for easy access
  const rootOutputPath = join(rootDir, 'latest.json');
  writeFileSync(rootOutputPath, JSON.stringify(latestJson, null, 2) + '\n', 'utf-8');
  console.log(`✅ Copy created: ${rootOutputPath}`);

  console.log('\n📋 Release Files Ready:');
  console.log(`   • Marvel-Rivals-Mod-Manager_${version}_x64-setup.exe`);
  console.log(`   • Marvel-Rivals-Mod-Manager_${version}_x64-setup.exe.sig`);
  console.log(`   • latest.json`);

  console.log('\n🚀 Next Steps:');
  console.log(`   1. Create GitHub release: ${versionTag}`);
  console.log(`   2. Upload all 3 files from: src-tauri/target/release/bundle/nsis/`);
  console.log(`   3. Publish the release`);
  console.log('\n✨ Done!\n');
}

try {
  generateLatestJson();
} catch (error) {
  console.error('\n❌ Error generating latest.json:', error.message);
  process.exit(1);
}
