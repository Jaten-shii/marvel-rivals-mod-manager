import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * Cross-platform utility to copy build files from .dev to dist structure
 * for proper Electron Builder packaging
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
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
  const sourceMain = join(process.cwd(), 'node_modules', '.dev', 'main')
  const destMain = join(process.cwd(), 'dist', 'main')

  console.log('🔄 Copying build files for packaging...')
  console.log(`   Source: ${relative(process.cwd(), sourceMain)}`)
  console.log(`   Destination: ${relative(process.cwd(), destMain)}`)

  // Check if source exists
  if (!existsSync(sourceMain)) {
    throw new Error(`Source directory does not exist: ${sourceMain}`)
  }

  try {
    // Copy main process files
    await copyDirectory(sourceMain, destMain)
    
    const mainFileSize = await stat(join(destMain, 'index.js'))
    console.log(`✅ Main process files copied successfully (${Math.round(mainFileSize.size / 1024)}KB)`)
    
  } catch (error) {
    console.error('❌ Failed to copy build files:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  copyBuildFiles()
}

export { copyBuildFiles }