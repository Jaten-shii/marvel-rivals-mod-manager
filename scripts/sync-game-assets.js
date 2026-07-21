#!/usr/bin/env node

/**
 * Sync Marvel Rivals character icons and costume icons from online sources.
 *
 * Sources:
 *   - Costume icons + data: rivalskins.com (complete game asset mirrors)
 *   - Character icons:      marvelrivals.wiki.gg
 *
 * Usage:
 *   node scripts/sync-game-assets.js              # sync everything
 *   node scripts/sync-game-assets.js --costumes   # costumes only
 *   node scripts/sync-game-assets.js --characters  # character icons only
 *   node scripts/sync-game-assets.js --dry-run    # preview without downloading
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ── Config ──────────────────────────────────────────────────────────────────

const RIVALSKINS_PAGE = 'https://rivalskins.com/?type=costume';
const RIVALSKINS_CDN = 'https://rivalskins.com/wp-content/uploads';
const WIKI_ICON_BASE = 'https://marvelrivals.wiki.gg/images';

const COSTUME_DATA_PATH = path.join(__dirname, '..', 'src-tauri', 'resources', 'costume-data.json');
const COSTUME_ICONS_DIR = path.join(__dirname, '..', 'public', 'assets', 'costume-icons');
const CHARACTER_ICONS_DIR = path.join(__dirname, '..', 'public', 'assets', 'character-icons');

// Map rivalskins folder ID -> our app's character display name
const FOLDER_TO_CHARACTER = {
  1: 'Adam Warlock', 2: 'Black Panther', 3: 'Captain America', 4: 'Doctor Strange',
  5: 'Groot', 6: 'Hawkeye', 7: 'Hela', 8: 'Hulk', 9: 'Iron Man',
  10: 'Jeff the Land Shark', 11: 'Loki', 12: 'Luna Snow', 13: 'Magik',
  14: 'Magneto', 15: 'Mantis', 16: 'Moon Knight', 17: 'Namor', 18: 'Peni Parker',
  19: 'Psylocke', 20: 'The Punisher', 21: 'Rocket Raccoon', 22: 'Scarlet Witch',
  23: 'Spider-Man', 24: 'Star-Lord', 25: 'Storm', 26: 'Thor', 27: 'Venom',
  28: 'Winter Soldier', 29: 'Black Widow', 30: 'Cloak and Dagger',
  31: 'Iron Fist', 32: 'Squirrel Girl', 33: 'Wolverine',
  34: 'Invisible Woman', 35: 'Mister Fantastic', 36: 'The Thing',
  37: 'Human Torch', 38: 'Emma Frost', 39: 'Ultron', 40: 'Phoenix',
  41: 'Blade', 42: 'Angela', 43: 'Daredevil', 44: 'Gambit', 45: 'Rogue',
  46: 'Deadpool',
  47: 'Elsa Bloodstone',
  48: 'White Fox',
  49: 'Black Cat',
  50: 'Devil Dinosaur',
  51: 'Cyclops',
  52: 'Jubilee',
};

// Character slug used for the default costume icon (when it differs from the folder slug)
// e.g. Hulk's default icon is img_icon_bruce-banner, not img_icon_hulk
const DEFAULT_ICON_OVERRIDES = {
  'Hulk': 'bruce-banner',
  'Peni Parker': 'sp-dr',
  'Cloak and Dagger': 'cloak-dagger',
};

// Wiki.gg icon filename overrides
const WIKI_ICON_OVERRIDE = {
  'Jeff the Land Shark': 'Jeff_the_Land_Shark_Icon.png',
  'Cloak and Dagger': 'Cloak_%26_Dagger_Icon.png',
  'Spider-Man': 'Spider-Man_Icon.png',
  'Star-Lord': 'Star-Lord_Icon.png',
};

// Our app's character icon filename mapping
const CHAR_ICON_FILENAME = {
  'Adam Warlock': 'Adam.png',
  'Jeff the Land Shark': 'Jeff.png',
  'The Punisher': 'Punisher.png',
  'Mister Fantastic': 'Mr. Fantastic.png',
  'Cloak and Dagger': 'Cloak & Dagger.png',
  'Spider-Man': 'Spider-Man.png',
  'Star-Lord': 'Star-Lord.png',
};

// Costume name overrides for slugs that don't convert cleanly
const COSTUME_NAME_OVERRIDES = {
  'growth-decay': 'Growth & Decay',
  'cloak-dagger': 'Cloak & Dagger',
  // rivalskins serves Elsa's "Silver Stalker" icon under a mangled "-2" slug
  '-2': 'Silver Stalker',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'MarvelRivalsModManager/4.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function slugToDisplayName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function toFolderSlug(charName) {
  return toSlug(charName);
}

// ── Core: Scrape rivalskins.com ─────────────────────────────────────────────

async function scrapeRivalskinsIcons() {
  console.log('Fetching rivalskins.com costume page...');
  const html = (await fetchUrl(RIVALSKINS_PAGE)).toString();

  // Extract all costume icon URLs: marvel-assets/items/costume/{id}/img_icon_{slug}.webp
  const regex = /marvel-assets\/items\/costume\/(\d+)\/img_icon_([^"]+)\.webp/g;
  const icons = new Map(); // "folderId/slug" -> { folderId, slug }

  let match;
  while ((match = regex.exec(html)) !== null) {
    const folderId = parseInt(match[1]);
    const slug = match[2];
    const key = `${folderId}/${slug}`;
    if (!icons.has(key)) {
      icons.set(key, { folderId, slug });
    }
  }

  console.log(`  Found ${icons.size} unique costume icons across ${new Set([...icons.values()].map(i => i.folderId)).size} characters`);
  return icons;
}

// ── Sync Costumes ───────────────────────────────────────────────────────────

async function syncCostumeIcons(dryRun) {
  console.log('\n=== Syncing Costume Icons ===\n');

  const icons = await scrapeRivalskinsIcons();

  // Group by folder ID
  const byFolder = new Map();
  for (const { folderId, slug } of icons.values()) {
    if (!byFolder.has(folderId)) byFolder.set(folderId, []);
    byFolder.get(folderId).push(slug);
  }

  const costumeData = {};
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let unknownFolders = new Set();

  for (const [folderId, slugs] of [...byFolder.entries()].sort((a, b) => a[0] - b[0])) {
    const charName = FOLDER_TO_CHARACTER[folderId];
    if (!charName) {
      unknownFolders.add(folderId);
      console.log(`  UNKNOWN FOLDER ${folderId}: ${slugs.length} icons (${slugs.slice(0, 3).join(', ')}...)`);
      console.log(`    Add to FOLDER_TO_CHARACTER in sync-game-assets.js`);
      continue;
    }

    const folderSlug = toFolderSlug(charName);
    const localDir = path.join(COSTUME_ICONS_DIR, folderSlug);
    const defaultSlug = DEFAULT_ICON_OVERRIDES[charName] || toSlug(charName);

    console.log(`${charName} (${slugs.length} costumes, folder ${folderId})`);

    const costumeEntries = [];

    for (const slug of slugs.sort()) {
      const isDefault = slug === defaultSlug;
      const localFilename = `img_icon_${slug}.png`;
      const localPath = path.join(localDir, localFilename);
      const imagePath = `${folderSlug}/${localFilename}`;

      costumeEntries.push({
        id: isDefault ? 'default' : slug,
        name: isDefault ? 'Default' : (COSTUME_NAME_OVERRIDES[slug] || slugToDisplayName(slug)),
        imagePath,
        ...(isDefault ? { isDefault: true } : {}),
      });

      if (fs.existsSync(localPath)) {
        skipped++;
        continue;
      }

      const remoteUrl = `${RIVALSKINS_CDN}/marvel-assets/items/costume/${folderId}/img_icon_${slug}.webp`;

      if (dryRun) {
        console.log(`    WOULD DOWNLOAD: ${slug}`);
        continue;
      }

      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      try {
        const buf = await fetchUrl(remoteUrl);
        fs.writeFileSync(localPath, buf);
        console.log(`    Downloaded: ${slug} (${(buf.length / 1024).toFixed(1)}KB)`);
        downloaded++;
        await sleep(50);
      } catch (err) {
        console.log(`    FAILED: ${slug} — ${err.message}`);
        failed++;
      }
    }

    // Sort: default first, then alphabetical
    costumeEntries.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });

    if (costumeEntries.length > 0) {
      costumeData[charName] = costumeEntries;
    }
  }

  // Write costume-data.json
  if (!dryRun) {
    const sorted = {};
    for (const key of Object.keys(costumeData).sort()) {
      sorted[key] = costumeData[key];
    }
    fs.writeFileSync(COSTUME_DATA_PATH, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`\nWrote ${COSTUME_DATA_PATH}`);
  }

  console.log(`\nCostume icons: ${downloaded} downloaded, ${skipped} existing, ${failed} failed`);
  if (unknownFolders.size > 0) {
    console.log(`  ${unknownFolders.size} unknown folder(s) — new characters! Add them to the script.`);
  }
}

// ── Sync Character Icons ────────────────────────────────────────────────────

async function syncCharacterIcons(dryRun) {
  console.log('\n=== Syncing Character Icons (wiki.gg) ===\n');

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  const characters = Object.values(FOLDER_TO_CHARACTER).sort();

  for (const name of characters) {
    const filename = CHAR_ICON_FILENAME[name] || `${name}.png`;
    const localPath = path.join(CHARACTER_ICONS_DIR, filename);

    if (fs.existsSync(localPath)) {
      skipped++;
      continue;
    }

    const wikiFilename = WIKI_ICON_OVERRIDE[name] || `${name.replace(/ /g, '_')}_Icon.png`;
    const url = `${WIKI_ICON_BASE}/${wikiFilename}`;

    if (dryRun) {
      console.log(`  WOULD DOWNLOAD: ${name} -> ${url}`);
      continue;
    }

    try {
      const buf = await fetchUrl(url);
      fs.writeFileSync(localPath, buf);
      console.log(`  Downloaded: ${name} (${(buf.length / 1024).toFixed(1)}KB)`);
      downloaded++;
      await sleep(200);
    } catch (err) {
      console.log(`  FAILED: ${name} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nCharacter icons: ${downloaded} downloaded, ${skipped} existing, ${failed} failed`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const costumesOnly = args.includes('--costumes');
  const charsOnly = args.includes('--characters');
  const syncAll = !costumesOnly && !charsOnly;

  console.log('Marvel Rivals Asset Sync');
  console.log('=======================');
  if (dryRun) console.log('(DRY RUN — no files will be written)\n');

  if (syncAll || costumesOnly) {
    await syncCostumeIcons(dryRun);
  }

  if (syncAll || charsOnly) {
    await syncCharacterIcons(dryRun);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
