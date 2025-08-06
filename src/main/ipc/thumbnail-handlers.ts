import { ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

import { settingsManager } from '../services/SettingsManager'
import { thumbnailProcessor } from '../services/ThumbnailProcessor'
import { SUPPORTED_EXTENSIONS, FILE_LIMITS } from 'shared/constants'

async function deleteOldThumbnails(thumbnailsPath: string, baseFileName: string): Promise<void> {
  // Delete any existing thumbnails with this base name
  const extensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif']
  
  for (const ext of extensions) {
    const oldPath = path.join(thumbnailsPath, `${baseFileName}${ext}`)
    try {
      await fs.unlink(oldPath)
      console.log(`Deleted old thumbnail: ${oldPath}`)
    } catch {
      // File doesn't exist, that's fine
    }
  }
}

export function registerThumbnailHandlers(): void {
  // Save thumbnail from local file
  ipcMain.handle('thumbnail:save', async (_, modId: string, imagePath: string, originalFileName?: string): Promise<string> => {
    try {
      const thumbnailsPath = settingsManager.getThumbnailsPath()
      await settingsManager.ensureAppDataStructure()
      
      // Validate image file
      const isValidImage = await validateImageFile(imagePath)
      if (!isValidImage) {
        throw new Error('Invalid image file format')
      }
      
      // Use original filename (without extension) if provided, otherwise use modId
      const baseFileName = originalFileName 
        ? path.basename(originalFileName, path.extname(originalFileName))
        : modId
      
      // Delete old thumbnails first
      await deleteOldThumbnails(thumbnailsPath, baseFileName)
      
      // Use optimized extension (.webp) for better compression
      const optimizedExt = thumbnailProcessor.getOptimizedExtension(path.extname(imagePath))
      const thumbnailFileName = `${baseFileName}${optimizedExt}`
      const thumbnailPath = path.join(thumbnailsPath, thumbnailFileName)
      
      // Process the image to 16:9 aspect ratio with optimization
      await thumbnailProcessor.processImage(imagePath, thumbnailPath)
      
      console.log(`Thumbnail processed and saved for mod ${modId}: ${thumbnailPath}`)
      return thumbnailPath
    } catch (error) {
      console.error('Error saving thumbnail:', error)
      throw new Error('Failed to save thumbnail')
    }
  })

  // Save thumbnail from URL
  ipcMain.handle('thumbnail:saveFromUrl', async (_, modId: string, imageUrl: string, originalFileName?: string): Promise<string> => {
    try {
      const thumbnailsPath = settingsManager.getThumbnailsPath()
      await settingsManager.ensureAppDataStructure()
      
      // Validate URL format
      if (!isValidImageUrl(imageUrl)) {
        throw new Error('Invalid image URL format')
      }
      
      // Use original filename (without extension) if provided, otherwise use modId
      const baseFileName = originalFileName 
        ? path.basename(originalFileName, path.extname(originalFileName))
        : modId
      
      // Delete old thumbnails first
      await deleteOldThumbnails(thumbnailsPath, baseFileName)
      
      // Use optimized extension (.webp) for better compression
      const optimizedExt = thumbnailProcessor.getOptimizedExtension('.jpg')
      const thumbnailFileName = `${baseFileName}${optimizedExt}`
      const thumbnailPath = path.join(thumbnailsPath, thumbnailFileName)
      
      // Download the image to a temporary buffer
      const imageBuffer = await downloadImageToBuffer(imageUrl)
      
      // Process the image buffer to 16:9 aspect ratio with optimization
      await thumbnailProcessor.processBuffer(imageBuffer, thumbnailPath)
      
      console.log(`Thumbnail downloaded and processed for mod ${modId}: ${thumbnailPath}`)
      return thumbnailPath
    } catch (error) {
      console.error('Error downloading thumbnail:', error)
      throw new Error('Failed to download thumbnail')
    }
  })

  // Delete thumbnail
  ipcMain.handle('thumbnail:delete', async (_, modId: string, originalFileName?: string): Promise<void> => {
    try {
      const thumbnailsPath = settingsManager.getThumbnailsPath()
      
      // Use original filename (without extension) if provided, otherwise use modId
      const baseFileName = originalFileName 
        ? path.basename(originalFileName, path.extname(originalFileName))
        : modId
      
      // Try to find and delete thumbnail with any supported extension, prioritizing .webp
      const extensions = ['.webp', ...SUPPORTED_EXTENSIONS.IMAGE_FILES]
      
      for (const ext of extensions) {
        const thumbnailPath = path.join(thumbnailsPath, `${baseFileName}${ext}`)
        
        try {
          await fs.unlink(thumbnailPath)
          console.log(`Thumbnail deleted for mod ${modId}: ${thumbnailPath}`)
          return
        } catch {
          // File doesn't exist, continue trying other extensions
        }
      }
      
      console.log(`No thumbnail found to delete for mod ${modId}`)
    } catch (error) {
      console.error('Error deleting thumbnail:', error)
      throw new Error('Failed to delete thumbnail')
    }
  })

  // Get thumbnail path
  ipcMain.handle('thumbnail:getPath', async (_, modId: string, originalFileName?: string): Promise<string | null> => {
    try {
      const thumbnailsPath = settingsManager.getThumbnailsPath()
      
      // Use original filename (without extension) if provided, otherwise use modId
      const baseFileName = originalFileName 
        ? path.basename(originalFileName, path.extname(originalFileName))
        : modId
      
      // Try to find thumbnail with any supported extension, prioritizing .webp
      const extensions = ['.webp', ...SUPPORTED_EXTENSIONS.IMAGE_FILES]
      
      for (const ext of extensions) {
        const thumbnailPath = path.join(thumbnailsPath, `${baseFileName}${ext}`)
        
        try {
          await fs.access(thumbnailPath)
          return thumbnailPath
        } catch {
          // File doesn't exist, continue trying other extensions
        }
      }
      
      return null
    } catch (error) {
      console.error('Error getting thumbnail path:', error)
      return null
    }
  })

  // List all thumbnails
  ipcMain.handle('thumbnail:listAll', async (): Promise<{ modId: string; path: string }[]> => {
    try {
      const thumbnailsPath = settingsManager.getThumbnailsPath()
      const thumbnails: { modId: string; path: string }[] = []
      
      try {
        const files = await fs.readdir(thumbnailsPath)
        const supportedExtensions = ['.webp', ...SUPPORTED_EXTENSIONS.IMAGE_FILES]
        
        for (const file of files) {
          const ext = path.extname(file).toLowerCase()
          if (supportedExtensions.includes(ext)) {
            const modId = path.basename(file, ext)
            const filePath = path.join(thumbnailsPath, file)
            thumbnails.push({ modId, path: filePath })
          }
        }
      } catch {
        // Directory doesn't exist or is empty
      }
      
      return thumbnails
    } catch (error) {
      console.error('Error listing thumbnails:', error)
      return []
    }
  })

  // Cleanup orphaned thumbnails (thumbnails without corresponding mods)
  ipcMain.handle('thumbnail:cleanup', async (_, validModIds: string[]): Promise<number> => {
    try {
      const thumbnailsPath = settingsManager.getThumbnailsPath()
      let cleanedCount = 0
      
      try {
        const files = await fs.readdir(thumbnailsPath)
        const supportedExtensions = ['.webp', ...SUPPORTED_EXTENSIONS.IMAGE_FILES]
        
        for (const file of files) {
          const ext = path.extname(file).toLowerCase()
          if (supportedExtensions.includes(ext)) {
            const modId = path.basename(file, ext)
            
            if (!validModIds.includes(modId)) {
              const filePath = path.join(thumbnailsPath, file)
              await fs.unlink(filePath)
              cleanedCount++
              console.log(`Cleaned up orphaned thumbnail: ${filePath}`)
            }
          }
        }
      } catch {
        // Directory doesn't exist or is empty
      }
      
      return cleanedCount
    } catch (error) {
      console.error('Error cleaning up thumbnails:', error)
      return 0
    }
  })
}

async function validateImageFile(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath)
    
    // Check file size
    if (stats.size > FILE_LIMITS.MAX_THUMBNAIL_SIZE) {
      return false
    }
    
    // Check file extension
    const ext = path.extname(filePath).toLowerCase()
    if (!SUPPORTED_EXTENSIONS.IMAGE_FILES.includes(ext)) {
      return false
    }
    
    // Basic file header validation
    const buffer = Buffer.alloc(12)
    const file = await fs.open(filePath, 'r')
    
    try {
      await file.read(buffer, 0, 12, 0)
      
      // Check for common image file signatures
      if (buffer.slice(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))) {
        return true // JPEG
      }
      if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
        return true // PNG
      }
      if (buffer.slice(0, 6).equals(Buffer.from('GIF87a')) || buffer.slice(0, 6).equals(Buffer.from('GIF89a'))) {
        return true // GIF
      }
      if (buffer.slice(8, 12).equals(Buffer.from('WEBP'))) {
        return true // WebP
      }
      
      return false
    } finally {
      await file.close()
    }
  } catch {
    return false
  }
}

function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

async function downloadImageToBuffer(url: string): Promise<Buffer> {
  const https = require('node:https')
  const http = require('node:http')
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const client = urlObj.protocol === 'https:' ? https : http
    
    const request = client.get(url, (response: any) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
        return
      }
      
      // Check content length
      const contentLength = parseInt(response.headers['content-length'] || '0', 10)
      if (contentLength > FILE_LIMITS.MAX_THUMBNAIL_SIZE) {
        reject(new Error('Image file is too large'))
        return
      }
      
      const chunks: Buffer[] = []
      let totalSize = 0
      
      response.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
        totalSize += chunk.length
        
        // Check if we're exceeding the size limit during download
        if (totalSize > FILE_LIMITS.MAX_THUMBNAIL_SIZE) {
          request.destroy()
          reject(new Error('Image file is too large'))
          return
        }
      })
      
      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        resolve(buffer)
      })
      
      response.on('error', reject)
    })
    
    request.on('error', reject)
    request.setTimeout(30000, () => {
      request.destroy()
      reject(new Error('Download timeout'))
    })
  })
}