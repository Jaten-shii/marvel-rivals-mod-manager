import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

import type { AppSettings, GameDirectoryInfo } from 'shared/types'
import { DEFAULT_SETTINGS, DEFAULT_GAME_PATHS, APPDATA_STRUCTURE } from 'shared/constants'

export class SettingsManager {
  private settingsPath: string
  private appDataPath: string
  private cachedSettings: AppSettings | null = null
  private validationCache: Map<string, GameDirectoryInfo> = new Map()

  constructor() {
    this.appDataPath = path.join(app.getPath('userData'), APPDATA_STRUCTURE.ROOT)
    this.settingsPath = path.join(this.appDataPath, APPDATA_STRUCTURE.SETTINGS)
  }

  async loadSettings(): Promise<AppSettings> {
    if (this.cachedSettings) {
      return this.cachedSettings
    }

    try {
      await this.ensureAppDataStructure()
      
      const settingsData = await fs.readFile(this.settingsPath, 'utf-8')
      const settings = JSON.parse(settingsData) as AppSettings
      
      // Merge with defaults to ensure all properties exist
      this.cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...settings,
      }
      
      return this.cachedSettings
    } catch (error) {
      console.log('Settings file not found, creating with defaults')
      this.cachedSettings = { ...DEFAULT_SETTINGS }
      await this.saveSettings(this.cachedSettings)
      return this.cachedSettings
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      await this.ensureAppDataStructure()
      
      const currentSettings = this.cachedSettings || DEFAULT_SETTINGS
      const updatedSettings: AppSettings = {
        ...currentSettings,
        ...settings,
      }
      
      await fs.writeFile(this.settingsPath, JSON.stringify(updatedSettings, null, 2))
      this.cachedSettings = updatedSettings
      
      console.log('Settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      throw new Error('Failed to save settings')
    }
  }

  async detectGameDirectory(): Promise<GameDirectoryInfo> {
    const possiblePaths = [
      DEFAULT_GAME_PATHS.STEAM_DEFAULT,
      DEFAULT_GAME_PATHS.STEAM_ALTERNATIVE,
      DEFAULT_GAME_PATHS.EPIC_DEFAULT,
    ]

    for (const basePath of possiblePaths) {
      const gameInfo = await this.validateGameDirectory(basePath)
      if (gameInfo.found) {
        return gameInfo
      }
    }

    // Check current settings for custom path
    const settings = await this.loadSettings()
    if (settings.gameDirectory) {
      const customGameInfo = await this.validateGameDirectory(settings.gameDirectory)
      if (customGameInfo.found) {
        return customGameInfo
      }
    }

    // Try to find through Steam registry (Windows only)
    if (process.platform === 'win32') {
      const steamPath = await this.findSteamInstallation()
      if (steamPath) {
        const gameInfo = await this.validateGameDirectory(steamPath)
        if (gameInfo.found) {
          return gameInfo
        }
      }
    }

    return {
      path: '',
      found: false,
      modsFolderExists: false,
      writable: false,
    }
  }

  async validateGameDirectory(gamePath: string): Promise<GameDirectoryInfo> {
    try {
      // Sanitize and normalize the path
      if (!gamePath || typeof gamePath !== 'string') {
        console.warn('Invalid gamePath provided:', gamePath)
        return {
          path: '',
          found: false,
          modsFolderExists: false,
          writable: false,
        }
      }

      // Remove mods subpath if user accidentally included it
      let cleanGamePath = gamePath.replace(/[\\\/]MarvelGame[\\\/]Marvel[\\\/]Content[\\\/]Paks[\\\/]~mods\s*$/, '')
      cleanGamePath = path.normalize(cleanGamePath)
      
      // Check cache first to prevent repeated validations
      const cached = this.validationCache.get(cleanGamePath)
      if (cached) {
        console.log('Using cached validation result for:', cleanGamePath)
        return cached
      }
      
      console.log('Validating game directory:', cleanGamePath)
      
      // Check if base game directory exists (this is our only requirement)
      try {
        await fs.access(cleanGamePath)
        console.log('Marvel Rivals directory found:', cleanGamePath)
      } catch {
        console.log('Marvel Rivals directory not found - game not installed at:', cleanGamePath)
        const notFoundResult: GameDirectoryInfo = {
          path: cleanGamePath,
          found: false,
          modsFolderExists: false,
          writable: false,
        }
        
        // Cache the not found result to prevent repeated checks
        this.validationCache.set(cleanGamePath, notFoundResult)
        return notFoundResult
      }

      // Game directory exists, now ensure mods folder exists
      const modsPath = path.join(cleanGamePath, DEFAULT_GAME_PATHS.MODS_SUBPATH)
      let modsFolderExists = false
      let writable = false

      console.log('Checking mods folder at:', modsPath)

      try {
        await fs.access(modsPath)
        modsFolderExists = true
        console.log('Mods folder exists')
      } catch {
        // Mods folder doesn't exist, create it
        console.log('Mods folder missing, creating...')
        try {
          await fs.mkdir(modsPath, { recursive: true })
          modsFolderExists = true
          console.log('Successfully created mods folder')
        } catch (error) {
          console.error('Failed to create mods folder:', error)
          const failedResult: GameDirectoryInfo = {
            path: cleanGamePath,
            found: true, // Game directory exists
            modsFolderExists: false,
            writable: false,
          }
          
          // Cache the failed result
          this.validationCache.set(cleanGamePath, failedResult)
          return failedResult
        }
      }

      // Test write access to mods folder
      const testFile = path.join(modsPath, '.write-test')
      try {
        await fs.writeFile(testFile, 'test')
        await fs.unlink(testFile)
        writable = true
        console.log('Mods folder is writable')
      } catch {
        writable = false
        console.warn('Mods folder is not writable')
      }

      const result: GameDirectoryInfo = {
        path: cleanGamePath,
        found: true, // Game directory exists
        modsFolderExists,
        writable,
      }
      
      // Cache the result for future calls
      this.validationCache.set(cleanGamePath, result)
      return result
    } catch (error) {
      console.error('Error validating game directory:', error)
      const errorResult: GameDirectoryInfo = {
        path: gamePath,
        found: false,
        modsFolderExists: false,
        writable: false,
      }
      
      // Cache the error result too to prevent repeated attempts
      this.validationCache.set(cleanGamePath, errorResult)
      return errorResult
    }
  }

  private async findSteamInstallation(): Promise<string | null> {
    if (process.platform !== 'win32') {
      return null
    }

    try {
      // Try to read Steam registry
      const { exec } = await import('node:child_process')
      const { promisify } = await import('node:util')
      const execAsync = promisify(exec)
      
      const result = await execAsync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath')
      const match = result.stdout.match(/InstallPath\s+REG_SZ\s+(.*)/i)
      
      if (match && match[1]) {
        const steamPath = match[1].trim()
        const gamePathCandidate = path.join(steamPath, 'steamapps', 'common', 'MarvelRivals')
        
        try {
          await fs.access(gamePathCandidate)
          return gamePathCandidate
        } catch {
          return null
        }
      }
    } catch {
      // Registry reading failed or not Windows
    }

    return null
  }

  async ensureAppDataStructure(): Promise<void> {
    try {
      // Create main app data directory
      await fs.mkdir(this.appDataPath, { recursive: true })
      
      // Create subdirectories
      await fs.mkdir(path.join(this.appDataPath, APPDATA_STRUCTURE.METADATA), { recursive: true })
      await fs.mkdir(path.join(this.appDataPath, APPDATA_STRUCTURE.THUMBNAILS), { recursive: true })
      await fs.mkdir(path.join(this.appDataPath, APPDATA_STRUCTURE.LOGS), { recursive: true })
      
    } catch (error) {
      console.error('Error creating app data structure:', error)
      throw new Error('Failed to create application data directories')
    }
  }

  getAppDataPath(): string {
    return this.appDataPath
  }

  getMetadataPath(): string {
    return path.join(this.appDataPath, APPDATA_STRUCTURE.METADATA)
  }

  getThumbnailsPath(): string {
    return path.join(this.appDataPath, APPDATA_STRUCTURE.THUMBNAILS)
  }

  getLogsPath(): string {
    return path.join(this.appDataPath, APPDATA_STRUCTURE.LOGS)
  }

  async resetSettings(): Promise<AppSettings> {
    this.cachedSettings = { ...DEFAULT_SETTINGS }
    await this.saveSettings(this.cachedSettings)
    return this.cachedSettings
  }

  async exportSettings(exportPath: string): Promise<void> {
    try {
      const settings = await this.loadSettings()
      await fs.writeFile(exportPath, JSON.stringify(settings, null, 2))
    } catch (error) {
      console.error('Error exporting settings:', error)
      throw new Error('Failed to export settings')
    }
  }

  async importSettings(importPath: string): Promise<AppSettings> {
    try {
      const settingsData = await fs.readFile(importPath, 'utf-8')
      const importedSettings = JSON.parse(settingsData) as AppSettings
      
      // Validate imported settings
      const validatedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...importedSettings,
      }
      
      await this.saveSettings(validatedSettings)
      return validatedSettings
    } catch (error) {
      console.error('Error importing settings:', error)
      throw new Error('Failed to import settings')
    }
  }

  // Helper method to update specific setting
  async updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<void> {
    const settings = await this.loadSettings()
    settings[key] = value
    await this.saveSettings(settings)
  }

  // Clear cached settings (useful after external changes)
  clearCache(): void {
    this.cachedSettings = null
    this.validationCache.clear()
  }

  // Clear validation cache specifically
  clearValidationCache(): void {
    this.validationCache.clear()
  }
}

// Singleton instance
export const settingsManager = new SettingsManager()