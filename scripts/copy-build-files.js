const { copyFile, mkdir, readdir, stat } = require('node:fs/promises')
const { join, relative, dirname } = require('node:path')
const { existsSync } = require('node:fs')

/**
 * Cross-platform utility to copy build files from .dev to dist structure
 * for proper Electron Builder packaging
 */
async function copyDirectory(src, dest) {
  try {
    // Ensure destination directory exists
    if (!existsSync(dest)) {
      await mkdir(dest, { recursive: true })
    }

    const entries = await readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = join(src, entry.name)
      const destPath = join(dest, entry.name)

      if (entry.isDirectory()) {
        await copyDirectory(srcPath, destPath)
      } else {
        // Ensure parent directory exists
        await mkdir(dirname(destPath), { recursive: true })
        await copyFile(srcPath, destPath)
      }
    }
  } catch (error) {
    console.error(`Error copying from ${src} to ${dest}:`, error)
    throw error
  }
}

async function copyBuildFiles() {
  const processes = [
    { name: 'main', source: 'main', dest: 'main' },
    { name: 'preload', source: 'preload', dest: 'preload' },
    { name: 'renderer', source: 'renderer', dest: 'renderer' }
  ]

  console.log('🔄 Copying all build files for packaging...')

  for (const proc of processes) {
    const sourcePath = join(process.cwd(), 'node_modules', '.dev', proc.source)
    const destPath = join(process.cwd(), 'dist', proc.dest)

    console.log(`   ${proc.name}: ${relative(process.cwd(), sourcePath)} → ${relative(process.cwd(), destPath)}`)

    // Check if source exists
    if (!existsSync(sourcePath)) {
      console.warn(`⚠️  Source directory does not exist: ${sourcePath}`)
      continue
    }

    try {
      // Copy process files
      await copyDirectory(sourcePath, destPath)
      
      // Get file size for main index file
      const indexFile = join(destPath, 'index.js')
      if (existsSync(indexFile)) {
        const fileSize = await stat(indexFile)
        console.log(`   ✅ ${proc.name} copied successfully (${Math.round(fileSize.size / 1024)}KB)`)
      } else {
        console.log(`   ✅ ${proc.name} copied successfully`)
      }
      
    } catch (error) {
      console.error(`❌ Failed to copy ${proc.name} files:`, error)
      process.exit(1)
    }
  }

  console.log('🎉 All build files copied successfully!')
}

// Run if called directly
if (require.main === module) {
  copyBuildFiles()
}

module.exports = { copyBuildFiles }