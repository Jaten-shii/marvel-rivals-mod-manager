import { app, protocol, net } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { URL } from 'node:url'

/**
 * ProtocolHandler service for secure file serving in Electron
 * Handles app:// protocol for thumbnails and assets
 */
export class ProtocolHandler {
  private readonly protocol = 'app'
  private readonly allowedPaths: Map<string, string> = new Map()

  constructor() {
    // Path registration will happen in register() method when app is ready
  }

  /**
   * Initialize the protocol handler
   * Must be called before app is ready
   */
  initialize(): void {
    // Register protocol as standard and secure
    protocol.registerSchemesAsPrivileged([
      {
        scheme: this.protocol,
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: false
        }
      }
    ])
  }

  /**
   * Register the protocol handler after app is ready
   */
  async register(): Promise<void> {
    // Register allowed paths first
    await this.registerAllowedPaths()
    
    protocol.handle(this.protocol, async (request) => {
      try {
        const url = new URL(request.url)
        console.log(`[ProtocolHandler] Handling request: ${request.url}`)
        console.log(`[ProtocolHandler] URL parts - hostname: ${url.hostname}, pathname: ${url.pathname}`)
        
        // Reconstruct the full path from hostname (category) and pathname (filename)
        const category = url.hostname
        const filename = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname
        const decodedFilename = decodeURIComponent(filename)
        const fullUrlPath = `/${category}/${decodedFilename}`
        
        console.log(`[ProtocolHandler] Reconstructed path: ${fullUrlPath}`)
        
        const filePath = await this.resolveFilePath(fullUrlPath)
        
        if (!filePath) {
          return new Response('Not Found', { status: 404 })
        }

        // Read the file
        const data = await fs.readFile(filePath)
        const mimeType = this.getMimeType(filePath)
        
        return new Response(data, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': data.length.toString()
          }
        })
      } catch (error) {
        console.error('Protocol handler error:', error)
        return new Response('Internal Server Error', { status: 500 })
      }
    })
  }

  /**
   * Register allowed path prefixes for security
   */
  private async registerAllowedPaths(): Promise<void> {
    // Import SettingsManager to get consistent paths
    const { settingsManager } = await import('./SettingsManager')
    
    // App data paths - use same paths as SettingsManager for consistency
    const thumbnailsPath = settingsManager.getThumbnailsPath()
    const metadataPath = settingsManager.getMetadataPath()
    
    console.log(`[ProtocolHandler] Thumbnails path: ${thumbnailsPath}`)
    console.log(`[ProtocolHandler] Metadata path: ${metadataPath}`)
    
    // Validate paths exist
    try {
      await fs.access(thumbnailsPath)
      console.log(`[ProtocolHandler] Thumbnails directory exists: ${thumbnailsPath}`)
    } catch (error) {
      console.warn(`[ProtocolHandler] Thumbnails directory not found: ${thumbnailsPath}`, error)
    }
    
    try {
      await fs.access(metadataPath)
      console.log(`[ProtocolHandler] Metadata directory exists: ${metadataPath}`)
    } catch (error) {
      console.warn(`[ProtocolHandler] Metadata directory not found: ${metadataPath}`, error)
    }
    
    // Register allowed paths
    this.allowedPaths.set('thumbnails', thumbnailsPath)
    this.allowedPaths.set('metadata', metadataPath)
    
    // Assets path - use reliable development mode detection with fallback
    let isDev: boolean
    try {
      isDev = !app.isPackaged()
    } catch (error) {
      // Fallback: detect development by checking if we're running from node_modules/.dev
      isDev = __dirname.includes('node_modules/.dev') || __dirname.includes('.dev')
    }
    
    let assetsPath: string
    
    if (isDev) {
      // In development, use the project root approach
      // Go up from the dev build location to project root
      const appPath = app.getAppPath()
      assetsPath = path.join(appPath, 'Assets')
    } else {
      // In production, try multiple possible locations like AssetPathResolver
      const appPath = app.getAppPath()
      const possiblePaths = [
        path.join(process.resourcesPath, 'app.asar.unpacked', 'Assets'), // Unpacked assets (primary)
        path.join(appPath, 'Assets'),                    // Inside asar (fallback)
        path.join(appPath, 'src', 'resources', 'Assets'), // Alternative asar location
        path.join(path.dirname(appPath), 'Assets'),      // Outside asar
        path.join(process.resourcesPath, 'Assets'),      // Resources directory
      ]

      // Find the first path that exists
      assetsPath = path.join(process.resourcesPath, 'Assets') // fallback
      const fs = require('fs')
      for (const possiblePath of possiblePaths) {
        try {
          fs.accessSync(possiblePath)
          assetsPath = possiblePath
          console.log(`[ProtocolHandler] Found assets at: ${possiblePath}`)
          break
        } catch {
          continue
        }
      }
    }
    
    console.log(`[ProtocolHandler] Assets path resolved to: ${assetsPath}`)
    console.log(`[ProtocolHandler] Character icons path: ${path.join(assetsPath, 'character-icons')}`)
    
    this.allowedPaths.set('assets', assetsPath)
    this.allowedPaths.set('character-icons', path.join(assetsPath, 'character-icons'))
  }

  /**
   * Resolve URL path to actual file path with security checks
   */
  private async resolveFilePath(urlPath: string): Promise<string | null> {
    try {
      // Remove leading slash
      const cleanPath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath
      
      // Parse the path components
      const [category, ...pathParts] = cleanPath.split('/')
      
      console.log(`[ProtocolHandler] Resolving path: ${urlPath} -> category: ${category}, parts: ${pathParts.join('/')}`)
      
      if (!category || pathParts.length === 0) {
        console.error(`[ProtocolHandler] Invalid path structure: ${urlPath}`)
        return null
      }

      // Get the base path for this category
      const basePath = this.allowedPaths.get(category)
      if (!basePath) {
        console.error(`[ProtocolHandler] Invalid category: ${category}. Available: ${Array.from(this.allowedPaths.keys()).join(', ')}`)
        return null
      }

      // Construct the full path
      const fullPath = path.join(basePath, ...pathParts)
      console.log(`[ProtocolHandler] Attempting to access file: ${fullPath}`)
      
      // Security check: ensure the resolved path is within the allowed directory
      const normalizedBase = path.normalize(basePath)
      const normalizedFull = path.normalize(fullPath)
      
      if (!normalizedFull.startsWith(normalizedBase)) {
        console.error('[ProtocolHandler] Path traversal attempt detected')
        return null
      }

      // Check if file exists
      try {
        await fs.access(fullPath)
        console.log(`[ProtocolHandler] File found: ${fullPath}`)
        return fullPath
      } catch (error) {
        console.error(`[ProtocolHandler] File not found: ${fullPath}`, error)
        return null
      }
    } catch (error) {
      console.error('[ProtocolHandler] Error resolving file path:', error)
      return null
    }
  }

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.txt': 'text/plain'
    }
    
    return mimeTypes[ext] || 'application/octet-stream'
  }

  /**
   * Convert a file path to an app:// URL
   */
  getFileUrl(category: string, fileName: string): string {
    return `${this.protocol}://${category}/${encodeURIComponent(fileName)}`
  }

  /**
   * Get thumbnail URL
   */
  getThumbnailUrl(fileName: string): string {
    return this.getFileUrl('thumbnails', fileName)
  }

  /**
   * Get character icon URL
   */
  getCharacterIconUrl(characterName: string): string {
    return this.getFileUrl('character-icons', `${characterName}.png`)
  }

  /**
   * Get asset URL
   */
  getAssetUrl(assetPath: string): string {
    return this.getFileUrl('assets', assetPath)
  }
}

// Singleton instance
export const protocolHandler = new ProtocolHandler()