#!/usr/bin/env node

/**
 * Script to download and optimize costume images from Marvel Rivals wiki
 *
 * Requirements:
 * - npm install axios cheerio sharp
 *
 * Usage:
 * - node scripts/download-costume-images.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');

// Configuration
const COSTUME_DATA_PATH = path.join(__dirname, '..', 'src-tauri', 'resources', 'costume-data.json');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'assets', 'costume-icons');
const IMAGE_SIZE = 512; // 512x512 for high quality
const WIKI_BASE_URL = 'https://marvelrivals.fandom.com';
const CONCURRENT_DOWNLOADS = 3; // Limit concurrent downloads to be polite to the wiki
const TIMEOUT_MS = 15000; // 15 second timeout per request

// Statistics tracking
const stats = {
  total: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

/**
 * Convert character name to URL-safe format
 */
function characterToUrlSlug(characterName) {
  // Special cases for wiki URLs
  const urlMap = {
    'Jeff the Land Shark': 'Jeff_the_Land_Shark',
    'Cloak and Dagger': 'Cloak_%26_Dagger',
    'Mister Fantastic': 'Mister_Fantastic',
    'The Punisher': 'The_Punisher',
    'The Thing': 'The_Thing'
  };

  if (urlMap[characterName]) {
    return urlMap[characterName];
  }

  return characterName.replace(/ /g, '_');
}

/**
 * Fetch the wiki cosmetics page for a character
 */
async function fetchWikiPage(characterName) {
  const urlSlug = characterToUrlSlug(characterName);
  const url = `${WIKI_BASE_URL}/wiki/${urlSlug}/Cosmetics`;

  try {
    console.log(`Fetching: ${url}`);
    const response = await axios.get(url, {
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      // Try without /Cosmetics suffix
      const fallbackUrl = `${WIKI_BASE_URL}/wiki/${urlSlug}`;
      console.log(`  Trying fallback: ${fallbackUrl}`);
      const response = await axios.get(fallbackUrl, {
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return response.data;
    }
    throw error;
  }
}

/**
 * Extract image URLs from wiki page HTML
 */
function extractImageUrls(html, costumeName) {
  const $ = cheerio.load(html);
  const imageUrls = [];

  // Strategy 1: Look for images in tables with data-source attributes
  $('figure.pi-item[data-source*="costume"], figure.pi-item[data-source*="skin"]').each((i, elem) => {
    const img = $(elem).find('img');
    if (img.length > 0) {
      const src = img.attr('src') || img.attr('data-src');
      if (src) {
        imageUrls.push(src);
      }
    }
  });

  // Strategy 2: Look for images in gallery sections
  $('.wikia-gallery-item img, .gallery img').each((i, elem) => {
    const src = $(elem).attr('src') || $(elem).attr('data-src');
    if (src && src.includes('.png') || src.includes('.jpg') || src.includes('.webp')) {
      imageUrls.push(src);
    }
  });

  // Strategy 3: Look for tabber content (common in fandom wikis)
  $('.tabber img, .wds-tab__content img').each((i, elem) => {
    const src = $(elem).attr('src') || $(elem).attr('data-src');
    if (src) {
      imageUrls.push(src);
    }
  });

  // Strategy 4: Look for any image with costume/skin in alt text
  $('img[alt*="costume" i], img[alt*="skin" i]').each((i, elem) => {
    const src = $(elem).attr('src') || $(elem).attr('data-src');
    if (src) {
      imageUrls.push(src);
    }
  });

  // Clean and deduplicate URLs
  const cleanUrls = [...new Set(imageUrls)]
    .map(url => {
      // Remove size parameters to get full resolution
      let cleanUrl = url.split('/revision/')[0];
      // Handle protocol-relative URLs
      if (cleanUrl.startsWith('//')) {
        cleanUrl = 'https:' + cleanUrl;
      }
      // Remove thumbnail size parameters
      cleanUrl = cleanUrl.replace(/\/scale-to-width-down\/\d+/, '');
      return cleanUrl;
    })
    .filter(url => {
      // Filter out icons, UI elements, and other non-costume images
      const lowerUrl = url.toLowerCase();
      return !lowerUrl.includes('icon') &&
             !lowerUrl.includes('ui_') &&
             !lowerUrl.includes('button') &&
             (lowerUrl.includes('.png') || lowerUrl.includes('.jpg') || lowerUrl.includes('.webp'));
    });

  return cleanUrls;
}

/**
 * Download image from URL
 */
async function downloadImage(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: TIMEOUT_MS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`Failed to download ${url}: ${error.message}`);
  }
}

/**
 * Optimize and save image
 */
async function optimizeAndSaveImage(imageBuffer, outputPath) {
  try {
    await sharp(imageBuffer)
      .resize(IMAGE_SIZE, IMAGE_SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: 90, effort: 6 })
      .toFile(outputPath);

    return true;
  } catch (error) {
    throw new Error(`Failed to optimize image: ${error.message}`);
  }
}

/**
 * Find best matching image for a costume
 */
function findBestMatch(imageUrls, costumeName) {
  if (imageUrls.length === 0) return null;
  if (imageUrls.length === 1) return imageUrls[0];

  // Normalize costume name for matching
  const normalizedName = costumeName.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/default/g, '')
    .replace(/costume/g, '')
    .replace(/skin/g, '');

  // Score each URL based on how well it matches the costume name
  const scored = imageUrls.map(url => {
    const urlLower = url.toLowerCase();
    let score = 0;

    // Exact name match in URL
    if (urlLower.includes(normalizedName)) {
      score += 100;
    }

    // Partial word matches
    const words = costumeName.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 3 && urlLower.includes(word)) {
        score += 10;
      }
    });

    // Prefer larger images
    if (urlLower.includes('1200px') || urlLower.includes('1000px')) {
      score += 5;
    }

    // Prefer certain file patterns
    if (urlLower.includes('portrait') || urlLower.includes('full')) {
      score += 3;
    }

    return { url, score };
  });

  // Sort by score and return best match
  scored.sort((a, b) => b.score - a.score);
  return scored[0].url;
}

/**
 * Process a single costume
 */
async function processCostume(characterName, costume, imageUrls) {
  const { imagePath, name, isDefault } = costume;
  const outputPath = path.join(OUTPUT_DIR, imagePath);

  // Check if image already exists
  if (fs.existsSync(outputPath)) {
    console.log(`  ⏭️  Skipped: ${name} (already exists)`);
    stats.skipped++;
    return;
  }

  // For default costume, might need special handling
  const searchName = isDefault ? 'default' : name;

  // Find best matching image
  const imageUrl = findBestMatch(imageUrls, searchName);

  if (!imageUrl) {
    const error = `No matching image found for ${characterName} - ${name}`;
    console.log(`  ❌ Failed: ${error}`);
    stats.failed++;
    stats.errors.push({ character: characterName, costume: name, error });
    return;
  }

  try {
    // Download image
    console.log(`  ⬇️  Downloading: ${name}`);
    const imageBuffer = await downloadImage(imageUrl);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Optimize and save
    console.log(`  🔧 Optimizing: ${name}`);
    await optimizeAndSaveImage(imageBuffer, outputPath);

    console.log(`  ✅ Success: ${name} -> ${imagePath}`);
    stats.successful++;
  } catch (error) {
    const errorMsg = error.message;
    console.log(`  ❌ Failed: ${name} - ${errorMsg}`);
    stats.failed++;
    stats.errors.push({ character: characterName, costume: name, error: errorMsg });
  }
}

/**
 * Process a single character
 */
async function processCharacter(characterName, costumes) {
  console.log(`\n📦 Processing: ${characterName}`);
  console.log(`   Costumes: ${costumes.length}`);

  try {
    // Fetch wiki page
    const html = await fetchWikiPage(characterName);

    // Extract image URLs
    const imageUrls = extractImageUrls(html, characterName);
    console.log(`   Found ${imageUrls.length} images on wiki page`);

    if (imageUrls.length === 0) {
      console.log(`   ⚠️  No images found for ${characterName}`);
      costumes.forEach(costume => {
        stats.failed++;
        stats.errors.push({
          character: characterName,
          costume: costume.name,
          error: 'No images found on wiki page'
        });
      });
      return;
    }

    // Process each costume
    for (const costume of costumes) {
      stats.total++;
      await processCostume(characterName, costume, imageUrls);
    }

  } catch (error) {
    console.log(`   ❌ Failed to fetch wiki page: ${error.message}`);
    costumes.forEach(costume => {
      stats.total++;
      stats.failed++;
      stats.errors.push({
        character: characterName,
        costume: costume.name,
        error: `Wiki fetch failed: ${error.message}`
      });
    });
  }
}

/**
 * Process characters in batches to limit concurrency
 */
async function processBatch(characters, startIndex, batchSize) {
  const batch = characters.slice(startIndex, startIndex + batchSize);
  const promises = batch.map(([characterName, costumes]) =>
    processCharacter(characterName, costumes)
  );
  await Promise.all(promises);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Marvel Rivals Costume Image Downloader');
  console.log('==========================================\n');

  // Read costume data
  console.log('📖 Reading costume data...');
  const costumeData = JSON.parse(fs.readFileSync(COSTUME_DATA_PATH, 'utf8'));
  const characters = Object.entries(costumeData).filter(([key]) => key !== '_comment');

  console.log(`✅ Found ${characters.length} characters`);

  // Calculate total costumes
  const totalCostumes = characters.reduce((sum, [, costumes]) => sum + costumes.length, 0);
  console.log(`✅ Found ${totalCostumes} total costumes`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`\n📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`🖼️  Target size: ${IMAGE_SIZE}x${IMAGE_SIZE}px WebP`);
  console.log(`⚡ Concurrent downloads: ${CONCURRENT_DOWNLOADS}\n`);

  // Process characters in batches
  const startTime = Date.now();

  for (let i = 0; i < characters.length; i += CONCURRENT_DOWNLOADS) {
    await processBatch(characters, i, CONCURRENT_DOWNLOADS);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Print summary
  console.log('\n\n📊 Summary Report');
  console.log('==================');
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`📦 Total costumes: ${stats.total}`);
  console.log(`✅ Successful: ${stats.successful}`);
  console.log(`⏭️  Skipped (existing): ${stats.skipped}`);
  console.log(`❌ Failed: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach(({ character, costume, error }) => {
      console.log(`   ${character} - ${costume}: ${error}`);
    });
  }

  console.log('\n✨ Done!');

  // Exit with error code if there were failures
  if (stats.failed > 0) {
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
