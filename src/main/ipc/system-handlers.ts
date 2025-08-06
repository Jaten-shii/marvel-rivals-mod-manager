import { ipcMain, shell, dialog } from 'electron'

import type { AppSettings, GameDirectoryInfo, AppStats } from 'shared/types'
import { settingsManager } from '../services/SettingsManager'
import { ModService } from '../services/ModService'
import { assetPathResolver } from '../services/AssetPathResolver'
import { protocolHandler } from '../services/ProtocolHandler'
import { CATEGORIES, CHARACTERS } from 'shared/constants'

export function registerSystemHandlers(): void {
  // Get application settings
  ipcMain.handle('system:getSettings', async (): Promise<AppSettings> => {
    return settingsManager.loadSettings()
  })

  // Check if application is properly configured
  ipcMain.handle('system:isConfigured', async (): Promise<boolean> => {
    try {
      const settings = await settingsManager.loadSettings()
      return !!(settings.gameDirectory && settings.modDirectory)
    } catch (error) {
      console.error('Error checking configuration:', error)
      return false
    }
  })

  // Save application settings
  ipcMain.handle('system:saveSettings', async (_, settings: Partial<AppSettings>): Promise<void> => {
    // Validate gameDirectory is a string if provided
    if (settings.gameDirectory !== undefined && settings.gameDirectory !== null && typeof settings.gameDirectory !== 'string') {
      throw new Error('Invalid gameDirectory: must be a string')
    }
    
    return settingsManager.saveSettings(settings)
  })

  // Detect game directory
  ipcMain.handle('system:detectGameDir', async (): Promise<GameDirectoryInfo> => {
    return settingsManager.detectGameDirectory()
  })

  // Select game directory manually
  ipcMain.handle('system:selectGameDir', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Marvel Rivals Installation Directory',
      properties: ['openDirectory'],
      message: 'Please select the Marvel Rivals installation directory (usually contains MarvelRivals.exe)'
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    
    const selectedPath = result.filePaths[0]
    
    // Validate the selected directory
    const gameInfo = await settingsManager.validateGameDirectory(selectedPath)
    if (!gameInfo.found) {
      throw new Error('Selected directory does not appear to contain a valid Marvel Rivals installation')
    }
    
    // Save the validated directory to settings
    await settingsManager.saveSettings({ gameDirectory: selectedPath })
    
    return selectedPath
  })

  // Get application statistics
  ipcMain.handle('system:getStats', async (): Promise<AppStats> => {
    try {
      const settings = await settingsManager.loadSettings()
      
      if (!settings.gameDirectory) {
        return {
          totalMods: 0,
          enabledMods: 0,
          disabledMods: 0,
          categories: [],
          characters: [],
          totalSize: 0,
        }
      }

      const modService = new ModService(settings.gameDirectory, settingsManager.getMetadataPath())
      const allMods = await modService.getAllMods()
      
      const enabledMods = allMods.filter(mod => mod.enabled)
      const disabledMods = allMods.filter(mod => !mod.enabled)
      
      // Calculate category stats
      const categoryStats = Object.keys(CATEGORIES).map(category => {
        const categoryMods = allMods.filter(mod => mod.category === category)
        return {
          category: category as any,
          count: categoryMods.length,
          enabled: categoryMods.filter(mod => mod.enabled).length,
          disabled: categoryMods.filter(mod => !mod.enabled).length,
        }
      })

      // Calculate character stats
      const characterStats = Object.keys(CHARACTERS).map(character => {
        const characterMods = allMods.filter(mod => mod.character === character)
        return {
          character: character as any,
          count: characterMods.length,
          enabled: characterMods.filter(mod => mod.enabled).length,
          disabled: characterMods.filter(mod => !mod.enabled).length,
        }
      }).filter(stat => stat.count > 0) // Only include characters with mods

      const totalSize = allMods.reduce((sum, mod) => sum + mod.fileSize, 0)

      return {
        totalMods: allMods.length,
        enabledMods: enabledMods.length,
        disabledMods: disabledMods.length,
        categories: categoryStats,
        characters: characterStats,
        totalSize,
      }
    } catch (error) {
      console.error('Error getting app stats:', error)
      return {
        totalMods: 0,
        enabledMods: 0,
        disabledMods: 0,
        categories: [],
        characters: [],
        totalSize: 0,
      }
    }
  })

  // Open external URL
  ipcMain.handle('system:openExternal', async (_, url: string): Promise<void> => {
    await shell.openExternal(url)
  })

  // Open folder in file explorer
  ipcMain.handle('system:openFolder', async (_, folderPath: string): Promise<void> => {
    await shell.openPath(folderPath)
  })

  // Select directory manually
  ipcMain.handle('system:selectDirectory', async (_, title: string = 'Select Directory'): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title,
      properties: ['openDirectory'],
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    
    return result.filePaths[0]
  })

  // Get app data paths
  ipcMain.handle('system:getAppDataPaths', async () => {
    return {
      appData: settingsManager.getAppDataPath(),
      metadata: settingsManager.getMetadataPath(),
      thumbnails: settingsManager.getThumbnailsPath(),
      logs: settingsManager.getLogsPath(),
    }
  })

  // Reset settings to defaults
  ipcMain.handle('system:resetSettings', async (): Promise<AppSettings> => {
    return settingsManager.resetSettings()
  })

  // Export settings
  ipcMain.handle('system:exportSettings', async (): Promise<void> => {
    const result = await dialog.showSaveDialog({
      title: 'Export Settings',
      defaultPath: 'marvel-rivals-mod-manager-settings.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    
    if (!result.canceled && result.filePath) {
      await settingsManager.exportSettings(result.filePath)
    }
  })

  // Import settings
  ipcMain.handle('system:importSettings', async (): Promise<AppSettings> => {
    const result = await dialog.showOpenDialog({
      title: 'Import Settings',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      throw new Error('No file selected')
    }
    
    return settingsManager.importSettings(result.filePaths[0])
  })

  // Check for updates (placeholder for future implementation)
  ipcMain.handle('system:checkForUpdates', async (): Promise<boolean> => {
    // TODO: Implement update checking logic
    return false
  })

  // Get system information
  ipcMain.handle('system:getSystemInfo', async () => {
    const os = require('node:os')
    const { app } = require('electron')
    
    return {
      appVersion: app.getVersion(),
      appName: app.getName(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      osVersion: os.release(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
    }
  })

  // Clear application cache
  ipcMain.handle('system:clearCache', async (): Promise<void> => {
    try {
      settingsManager.clearCache()
      
      // Clear any other cached data
      const { session } = require('electron')
      await session.defaultSession.clearCache()
      
      console.log('Application cache cleared')
    } catch (error) {
      console.error('Error clearing cache:', error)
      throw new Error('Failed to clear application cache')
    }
  })

  // Restart application
  ipcMain.handle('system:restart', async (): Promise<void> => {
    const { app } = require('electron')
    app.relaunch()
    app.exit()
  })

  // ===== Enhanced Folder Operations =====

  // Check folder permissions and properties
  ipcMain.handle('system:checkFolderPermissions', async (_, folderPath: string): Promise<{
    exists: boolean
    readable: boolean
    writable: boolean
    isDirectory: boolean
  }> => {
    const fs = require('node:fs').promises
    const constants = require('node:fs').constants
    
    try {
      const stats = await fs.stat(folderPath)
      
      let readable = false
      let writable = false
      
      try {
        await fs.access(folderPath, constants.R_OK)
        readable = true
      } catch {}
      
      try {
        await fs.access(folderPath, constants.W_OK)
        writable = true
      } catch {}
      
      return {
        exists: true,
        readable,
        writable,
        isDirectory: stats.isDirectory(),
      }
    } catch {
      return {
        exists: false,
        readable: false,
        writable: false,
        isDirectory: false,
      }
    }
  })

  // Create directory with parents
  ipcMain.handle('system:createDirectory', async (_, dirPath: string): Promise<boolean> => {
    try {
      const fs = require('node:fs').promises
      await fs.mkdir(dirPath, { recursive: true })
      return true
    } catch (error) {
      console.error('Error creating directory:', error)
      return false
    }
  })

  // Get folder metadata and contents summary
  ipcMain.handle('system:getFolderInfo', async (_, folderPath: string): Promise<{
    exists: boolean
    size: number
    fileCount: number
    folderCount: number
    lastModified: string
    isEmpty: boolean
  }> => {
    const fs = require('node:fs').promises
    const path = require('node:path')
    
    try {
      const stats = await fs.stat(folderPath)
      
      if (!stats.isDirectory()) {
        throw new Error('Path is not a directory')
      }
      
      const entries = await fs.readdir(folderPath, { withFileTypes: true })
      const files = entries.filter(entry => entry.isFile())
      const folders = entries.filter(entry => entry.isDirectory())
      
      // Calculate total size of files in directory
      let totalSize = 0
      for (const file of files) {
        try {
          const filePath = path.join(folderPath, file.name)
          const fileStats = await fs.stat(filePath)
          totalSize += fileStats.size
        } catch {
          // Skip files we can't read
        }
      }
      
      return {
        exists: true,
        size: totalSize,
        fileCount: files.length,
        folderCount: folders.length,
        lastModified: stats.mtime.toISOString(),
        isEmpty: entries.length === 0,
      }
    } catch (error) {
      return {
        exists: false,
        size: 0,
        fileCount: 0,
        folderCount: 0,
        lastModified: '',
        isEmpty: true,
      }
    }
  })

  // Select mod directory with validation
  ipcMain.handle('system:selectModDirectory', async (_, title: string = 'Select Mod Directory'): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title,
      properties: ['openDirectory'],
      message: 'Select the directory where you want to store mod files'
    })
    
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    
    const selectedPath = result.filePaths[0]
    
    // Validate the selected directory is writable
    const fs = require('node:fs').promises
    const constants = require('node:fs').constants
    
    try {
      await fs.access(selectedPath, constants.W_OK)
      return selectedPath
    } catch {
      throw new Error('Selected directory is not writable. Please choose a different location.')
    }
  })

  // Validate if path is safe for mod operations
  ipcMain.handle('system:validateModPath', async (_, folderPath: string): Promise<{
    isValid: boolean
    reason?: string
    suggestions?: string[]
  }> => {
    const fs = require('node:fs').promises
    const path = require('node:path')
    const constants = require('node:fs').constants
    
    try {
      // Check if path exists
      const stats = await fs.stat(folderPath)
      
      if (!stats.isDirectory()) {
        return {
          isValid: false,
          reason: 'Path is not a directory',
          suggestions: ['Select a valid folder path']
        }
      }
      
      // Check if writable
      try {
        await fs.access(folderPath, constants.W_OK)
      } catch {
        return {
          isValid: false,
          reason: 'Directory is not writable',
          suggestions: [
            'Check folder permissions',
            'Try running as administrator',
            'Select a different folder'
          ]
        }
      }
      
      // Check if it's a system directory (basic safety check)
      const normalizedPath = path.normalize(folderPath).toLowerCase()
      const systemPaths = ['c:\\windows', 'c:\\program files', 'c:\\program files (x86)']
      
      for (const sysPath of systemPaths) {
        if (normalizedPath.startsWith(sysPath) && !normalizedPath.includes('steam')) {
          return {
            isValid: false,
            reason: 'Cannot use system directories for mod storage',
            suggestions: [
              'Choose a location in your Documents folder',
              'Create a dedicated mods folder on your desktop',
              'Use the default game mods directory'
            ]
          }
        }
      }
      
      return {
        isValid: true
      }
    } catch {
      return {
        isValid: false,
        reason: 'Path does not exist',
        suggestions: ['Check the path and try again', 'Browse for a valid folder']
      }
    }
  })

  // Get character icon URL for renderer use
  ipcMain.handle('system:getCharacterIconUrl', async (_, characterName: string): Promise<string> => {
    try {
      return assetPathResolver.getCharacterIconUrl(characterName)
    } catch (error) {
      console.error('Error getting character icon URL:', error)
      return assetPathResolver.getDefaultCharacterIconUrl()
    }
  })

  // Check if character icon exists
  ipcMain.handle('system:characterIconExists', async (_, characterName: string): Promise<boolean> => {
    try {
      return await assetPathResolver.characterIconExists(characterName)
    } catch (error) {
      console.error('Error checking character icon existence:', error)
      return false
    }
  })

  // Get available character icons
  ipcMain.handle('system:getAvailableCharacterIcons', async (): Promise<string[]> => {
    try {
      return await assetPathResolver.getAvailableCharacterIcons()
    } catch (error) {
      console.error('Error getting available character icons:', error)
      return []
    }
  })

  // Get asset debug info
  ipcMain.handle('system:getAssetDebugInfo', async () => {
    try {
      return assetPathResolver.getDebugInfo()
    } catch (error) {
      console.error('Error getting asset debug info:', error)
      return null
    }
  })

  // Get file URL using app:// protocol
  ipcMain.handle('system:getFileUrl', async (_, category: string, fileName: string): Promise<string> => {
    try {
      return protocolHandler.getFileUrl(category, fileName)
    } catch (error) {
      console.error('Error getting file URL:', error)
      throw new Error('Failed to get file URL')
    }
  })

  // Get thumbnail URL
  ipcMain.handle('system:getThumbnailUrl', async (_, fileName: string): Promise<string> => {
    try {
      return protocolHandler.getThumbnailUrl(fileName)
    } catch (error) {
      console.error('Error getting thumbnail URL:', error)
      throw new Error('Failed to get thumbnail URL')
    }
  })

  // Get character icon URL using app:// protocol
  ipcMain.handle('system:getCharacterIconProtocolUrl', async (_, characterName: string): Promise<string> => {
    try {
      return protocolHandler.getCharacterIconUrl(characterName)
    } catch (error) {
      console.error('Error getting character icon protocol URL:', error)
      return protocolHandler.getCharacterIconUrl('default')
    }
  })
}