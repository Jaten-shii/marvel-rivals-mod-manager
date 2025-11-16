# Costume Image Downloader

This script downloads and optimizes costume images from the Marvel Rivals wiki for all characters in the costume database.

## Features

- ✅ Fetches images from Marvel Rivals Fandom wiki
- ✅ Automatically extracts costume images from wiki pages
- ✅ Optimizes images to 512x512 WebP format
- ✅ Creates character subdirectories automatically
- ✅ Skips already downloaded images
- ✅ Concurrent downloads (3 at a time)
- ✅ Comprehensive error handling and reporting
- ✅ Progress tracking and statistics

## Installation

From the `scripts/` directory:

```bash
npm install
```

## Usage

From the `scripts/` directory:

```bash
npm run download
```

Or directly:

```bash
node download-costume-images.js
```

## How It Works

1. **Reads** costume data from `src-tauri/resources/costume-data.json`
2. **Fetches** wiki pages for each character from `https://marvelrivals.fandom.com/wiki/{Character}/Cosmetics`
3. **Extracts** image URLs using multiple strategies:
   - Data-source attributes in figure elements
   - Gallery sections
   - Tabber content
   - Alt text matching
4. **Matches** images to costumes using intelligent scoring algorithm
5. **Downloads** images with proper headers and timeout handling
6. **Optimizes** images:
   - Resizes to 512x512 pixels
   - Maintains aspect ratio with transparent padding
   - Converts to WebP format (90% quality)
   - Uses sharp for high-quality processing
7. **Saves** to `public/assets/costume-icons/{character}/{costume}.webp`

## Output

Images are saved to:
```
public/assets/costume-icons/
├── adam-warlock/
│   ├── default.webp
│   ├── blood-soul.webp
│   └── ...
├── spider-man/
│   ├── default.webp
│   ├── spider-man-no-way-home.webp
│   └── ...
└── ...
```

## Configuration

You can modify these constants in `download-costume-images.js`:

- `IMAGE_SIZE`: Target image size (default: 512x512)
- `CONCURRENT_DOWNLOADS`: Max concurrent downloads (default: 3)
- `TIMEOUT_MS`: Request timeout in milliseconds (default: 15000)

## Error Handling

The script includes comprehensive error handling:

- **404 errors**: Tries fallback URL without `/Cosmetics` suffix
- **Network timeouts**: 15-second timeout with retry logic
- **Invalid images**: Gracefully skips and reports
- **Missing directories**: Creates subdirectories as needed
- **Duplicate images**: Skips already downloaded files

## Statistics Report

After completion, you'll see a summary:

```
📊 Summary Report
==================
⏱️  Duration: 123.45s
📦 Total costumes: 250
✅ Successful: 235
⏭️  Skipped (existing): 10
❌ Failed: 5

❌ Errors:
   Character Name - Costume Name: Error message
```

## Troubleshooting

### No images found for a character

Some characters may have different wiki page structures. The script tries multiple extraction strategies, but some manual intervention may be needed.

### Download failures

- Check your internet connection
- The wiki may be temporarily unavailable
- Rate limiting: The script respects the wiki with limited concurrency

### Sharp installation issues

Sharp requires native dependencies. If installation fails:

```bash
npm install --platform=win32 --arch=x64 sharp
```

Or use the included `sharp` fallback in the system.

## Dependencies

- **axios**: HTTP client for downloading
- **cheerio**: HTML parsing and image extraction
- **sharp**: High-performance image optimization

## License

MIT
