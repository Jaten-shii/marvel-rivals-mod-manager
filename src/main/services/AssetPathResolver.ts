import { app } from 'electron'
import path from 'node:path'
import { promises as fs } from 'node:fs'

/**
 * AssetPathResolver service for handling Electron-safe asset path resolution
 * Provides proper paths for character icons and other assets in both development and production
 */
export class AssetPathResolver {
  private assetBasePath: string
  private isDevelopment: boolean

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
    this.assetBasePath = this.resolveAssetBasePath()
  }

  /**
   * Get the absolute path to a character icon
   * @param characterName - The character name (e.g., "Jeff", "Black Panther")
   * @returns Absolute path to the character icon file
   */
  getCharacterIconPath(characterName: string): string {
    const iconFileName = `${characterName}.png`
    const iconPath = path.join(this.assetBasePath, 'character-icons', iconFileName)
    return iconPath
  }

  /**
   * Get the absolute path to any asset file
   * @param relativePath - Relative path within the Assets directory (e.g., "character-icons/Jeff.png")
   * @returns Absolute path to the asset file
   */
  getAssetPath(relativePath: string): string {
    return path.join(this.assetBasePath, relativePath)
  }

  /**
   * Check if a character icon exists
   * @param characterName - The character name
   * @returns Promise<boolean> - Whether the icon file exists
   */
  async characterIconExists(characterName: string): Promise<boolean> {
    try {
      const iconPath = this.getCharacterIconPath(characterName)
      await fs.access(iconPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get a file:// URL for a character icon (safe for renderer use)
   * @param characterName - The character name
   * @returns file:// URL string
   */
  getCharacterIconUrl(characterName: string): string {
    const iconPath = this.getCharacterIconPath(characterName)
    return `file://${iconPath}`
  }

  /**
   * Get a file:// URL for any asset (safe for renderer use)
   * @param relativePath - Relative path within the Assets directory
   * @returns file:// URL string
   */
  getAssetUrl(relativePath: string): string {
    const assetPath = this.getAssetPath(relativePath)
    return `file://${assetPath}`
  }

  /**
   * Get the default character icon path (fallback)
   * @returns Absolute path to the default character icon
   */
  getDefaultCharacterIconPath(): string {
    return path.join(this.assetBasePath, 'character-icons', 'default.png')
  }

  /**
   * Get the default character icon URL (fallback)
   * @returns file:// URL for the default character icon
   */
  getDefaultCharacterIconUrl(): string {
    return `file://${this.getDefaultCharacterIconPath()}`
  }

  /**
   * Resolve the base path for assets based on the environment
   * @returns Absolute path to the Assets directory
   */
  private resolveAssetBasePath(): string {
    if (this.isDevelopment) {
      // In development, assets are in the project root
      const projectRoot = path.resolve(__dirname, '..', '..', '..')
      return path.join(projectRoot, 'Assets')
    } else {
      // In production, assets should be in the app's resources
      const appPath = app.getAppPath()
      
      // Try multiple possible locations for assets in production
      const possiblePaths = [
        path.join(appPath, 'Assets'),
        path.join(appPath, 'src', 'resources', 'Assets'),
        path.join(path.dirname(appPath), 'Assets'),
        path.join(process.resourcesPath, 'Assets'),
      ]

      // Return the first path that exists
      for (const possiblePath of possiblePaths) {
        try {
          require('fs').accessSync(possiblePath)
          console.log(`Using assets path: ${possiblePath}`)
          return possiblePath
        } catch {
          continue
        }
      }

      // Fallback to development path if nothing else works
      console.warn('Could not find assets directory in production, falling back to development path')
      const projectRoot = path.resolve(__dirname, '..', '..', '..')
      return path.join(projectRoot, 'Assets')
    }
  }

  /**
   * List all available character icons
   * @returns Promise<string[]> - Array of character names that have icons
   */
  async getAvailableCharacterIcons(): Promise<string[]> {
    try {
      const characterIconsDir = path.join(this.assetBasePath, 'character-icons')
      const files = await fs.readdir(characterIconsDir)
      
      return files
        .filter(file => file.endsWith('.png') && file !== 'default.png')
        .map(file => path.basename(file, '.png'))
    } catch (error) {
      console.error('Error listing character icons:', error)
      return []
    }
  }

  /**
   * Get debug information about asset paths
   * @returns Object with path information for debugging
   */
  getDebugInfo(): {
    isDevelopment: boolean
    assetBasePath: string
    appPath: string
    resourcesPath: string | undefined
  } {
    return {
      isDevelopment: this.isDevelopment,
      assetBasePath: this.assetBasePath,
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath,
    }
  }
}

// Singleton instance
export const assetPathResolver = new AssetPathResolver()