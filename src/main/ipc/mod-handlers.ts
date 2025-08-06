import { ipcMain, dialog } from 'electron'
import path from 'node:path'

import type { ModInfo, ModMetadata, ModOrganizationProgress, OrganizationResult, ModGroup, ExtractedModGroups } from 'shared/types'
import { ModService } from '../services/ModService'
import { ArchiveExtractor } from '../services/ArchiveExtractor'
import { settingsManager } from '../services/SettingsManager'
import { fileWatcher } from '../services/FileWatcher'
import { SUPPORTED_EXTENSIONS } from 'shared/constants'

let modService: ModService | null = null
let archiveExtractor: ArchiveExtractor | null = null

// Initialize services with current settings
async function initializeServices(): Promise<void> {
  try {
    const settings = await settingsManager.loadSettings()
    
    // Validate that gameDirectory is a string if it exists
    if (settings.gameDirectory && typeof settings.gameDirectory !== 'string') {
      console.warn('Invalid gameDirectory type detected, resetting to empty string')
      settings.gameDirectory = ''
    }
    
    if (!settings.gameDirectory) {
      const gameInfo = await settingsManager.detectGameDirectory()
      if (gameInfo.found && gameInfo.path) {
        await settingsManager.saveSettings({ gameDirectory: gameInfo.path })
        settings.gameDirectory = gameInfo.path
      }
    }

    if (settings.gameDirectory && typeof settings.gameDirectory === 'string') {
      const metadataPath = settingsManager.getMetadataPath()
      const tempPath = path.join(settingsManager.getAppDataPath(), 'temp')
      
      modService = new ModService(settings.gameDirectory, metadataPath)
      archiveExtractor = new ArchiveExtractor(tempPath)
      
      // Start file watcher
      const modsPath = path.join(settings.gameDirectory, 'MarvelGame\\Marvel\\Content\\Paks\\~mods')
      await fileWatcher.startWatching(modsPath)
      
      console.log('Services initialized successfully for:', settings.gameDirectory)
      
      // Run startup organization (silent, no progress UI)
      try {
        console.log('[ModService] Running startup organization...')
        const result = await modService.organizeAllMods(false)
        console.log(`[ModService] Startup organization complete: ${result.movedMods} mods moved, ${result.errorCount} errors`)
        
        if (result.errorCount > 0) {
          console.warn(`[ModService] Startup organization had ${result.errorCount} errors:`, result.errors)
        }
        
        // Send startup complete event to renderer processes
        setTimeout(() => {
          const windows = require('electron').BrowserWindow.getAllWindows()
          windows.forEach(window => {
            window.webContents.send('app:startupComplete', result)
          })
        }, 2000) // Small delay to ensure renderer is ready
      } catch (error) {
        console.error('[ModService] Startup organization failed:', error)
        // Don't throw - continue with app startup even if organization fails
        
        // Send failed startup event
        setTimeout(() => {
          const windows = require('electron').BrowserWindow.getAllWindows()
          windows.forEach(window => {
            window.webContents.send('app:startupComplete', {
              totalMods: 0,
              movedMods: 0,
              errorCount: 1,
              errors: [error instanceof Error ? error.message : String(error)],
              duration: 0
            })
          })
        }, 2000)
      }
    } else {
      console.log('No valid game directory found, services not initialized')
    }
  } catch (error) {
    console.error('Error initializing services:', error)
  }
}

// Initialize services on startup
initializeServices()

export function registerModHandlers(): void {
  // Get all mods
  ipcMain.handle('mod:getAll', async (): Promise<ModInfo[]> => {
    if (!modService) {
      await initializeServices()
    }
    
    // Return empty array if service not initialized (graceful degradation)
    if (!modService) {
      console.warn('Mod service not initialized - game directory not configured')
      return []
    }
    
    return modService.getAllMods()
  })

  // Install mod from file
  ipcMain.handle('mod:install', async (_, filePath: string): Promise<ModInfo> => {
    if (!modService || !archiveExtractor) {
      await initializeServices()
    }
    
    if (!modService || !archiveExtractor) {
      throw new Error('Game directory not configured. Please set up the Marvel Rivals installation path in settings.')
    }

    try {
      const isArchive = SUPPORTED_EXTENSIONS.ARCHIVE_FILES.includes(
        path.extname(filePath).toLowerCase()
      )

      if (isArchive) {
        // Extract archive and install mod files
        const settings = await settingsManager.loadSettings()
        const tempDir = path.join(settingsManager.getAppDataPath(), 'temp', Date.now().toString())
        const modsDir = path.join(settings.gameDirectory, 'MarvelGame\\Marvel\\Content\\Paks\\~mods')
        
        // Extract archive
        const extractedFiles = await archiveExtractor.extractArchive(filePath, tempDir)
        const modFiles = await archiveExtractor.findModFiles(extractedFiles)
        
        if (modFiles.length === 0) {
          throw new Error('No mod files found in archive')
        }

        // Install all mod files found (.pak, .ucas, .utoc)
        const installedPaths: string[] = []
        
        for (const modFile of modFiles) {
          const targetPath = path.join(modsDir, path.basename(modFile.originalPath))
          await require('node:fs').promises.copyFile(modFile.extractedPath, targetPath)
          installedPaths.push(targetPath)
          console.log(`Installed mod file: ${targetPath}`)
        }
        
        // Clean up temp files
        await archiveExtractor.cleanupTempFiles(extractedFiles)
        
        // Return mod info for the primary mod file (.pak file)
        const allMods = await modService.getAllMods()
        const pakFile = installedPaths.find(path => path.toLowerCase().endsWith('.pak'))
        const installedMod = allMods.find(mod => mod.filePath === pakFile)
        
        if (!installedMod) {
          throw new Error('Failed to find installed mod')
        }
        
        return installedMod
      } else {
        // Direct .pak file installation
        const settings = await settingsManager.loadSettings()
        const modsDir = path.join(settings.gameDirectory, 'MarvelGame\\Marvel\\Content\\Paks\\~mods')
        const targetPath = path.join(modsDir, path.basename(filePath))
        
        await require('node:fs').promises.copyFile(filePath, targetPath)
        
        // Return mod info for the installed file
        const allMods = await modService.getAllMods()
        const installedMod = allMods.find(mod => mod.filePath === targetPath)
        
        if (!installedMod) {
          throw new Error('Failed to find installed mod')
        }
        
        return installedMod
      }
    } catch (error) {
      console.error('Error installing mod:', error)
      throw error
    }
  })

  // Enable/disable mod
  ipcMain.handle('mod:enable', async (_, modId: string, enabled: boolean): Promise<void> => {
    if (!modService) {
      throw new Error('Game directory not configured. Please set up the Marvel Rivals installation path in settings.')
    }
    
    return modService.enableMod(modId, enabled)
  })

  // Delete mod
  ipcMain.handle('mod:delete', async (_, modId: string): Promise<void> => {
    console.log(`[IPC] mod:delete handler called for modId: ${modId}`)
    console.log(`[IPC] modService available:`, !!modService)
    
    if (!modService) {
      console.error(`[IPC] modService not available - game directory not configured`)
      throw new Error('Game directory not configured. Please set up the Marvel Rivals installation path in settings.')
    }
    
    try {
      console.log(`[IPC] About to call modService.deleteMod(${modId})`)
      const result = await modService.deleteMod(modId)
      console.log(`[IPC] Successfully called modService.deleteMod`)
      return result
    } catch (error) {
      console.error(`[IPC] Error in mod:delete handler:`, error)
      throw error
    }
  })

  // Update mod metadata
  ipcMain.handle('mod:updateMetadata', async (_, modId: string, metadata: Partial<ModMetadata>): Promise<ModInfo> => {
    if (!modService) {
      throw new Error('Game directory not configured. Please set up the Marvel Rivals installation path in settings.')
    }
    
    return modService.updateMetadata(modId, metadata)
  })

  // Reorganize mod
  ipcMain.handle('mod:reorganize', async (_, modId: string): Promise<void> => {
    if (!modService) {
      throw new Error('Game directory not configured. Please set up the Marvel Rivals installation path in settings.')
    }
    
    return modService.reorganizeMod(modId)
  })

  // Get associated files for a mod
  ipcMain.handle('mod:getAssociatedFiles', async (_, modId: string): Promise<string[]> => {
    if (!modService) {
      throw new Error('Game directory not configured. Please set up the Marvel Rivals installation path in settings.')
    }
    
    return modService.getAssociatedFiles(modId)
  })

  // File selection dialog
  ipcMain.handle('fs:selectModFiles', async (): Promise<string[]> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Mod Files',
      filters: [
        {
          name: 'Mod Files',
          extensions: ['pak', 'zip', 'rar', '7z']
        },
        {
          name: 'Archive Files',
          extensions: ['zip', 'rar', '7z']
        },
        {
          name: 'PAK Files',
          extensions: ['pak']
        }
      ],
      properties: ['openFile', 'multiSelections']
    })
    
    return result.filePaths
  })

  // File selection dialog with custom options
  ipcMain.handle('fs:selectFiles', async (_, options: { 
    filters?: Array<{ name: string; extensions: string[] }>; 
    properties?: string[] 
  }): Promise<string[]> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Files',
      filters: options.filters || [
        {
          name: 'All Files',
          extensions: ['*']
        }
      ],
      properties: (options.properties as any) || ['openFile', 'multiSelections']
    })
    
    return result.filePaths
  })

  // Open folder functionality moved to system:openFolder (removed duplicate)

  // Start file watching
  ipcMain.handle('fs:watchMods', async (): Promise<void> => {
    const settings = await settingsManager.loadSettings()
    if (settings.gameDirectory) {
      const modsPath = path.join(settings.gameDirectory, 'MarvelGame\\Marvel\\Content\\Paks\\~mods')
      await fileWatcher.startWatching(modsPath)
    }
  })

  // Check if path exists
  ipcMain.handle('fs:exists', async (_, filePath: string): Promise<boolean> => {
    try {
      const fs = require('node:fs').promises
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  })

  // Watch specific directory
  ipcMain.handle('fs:watchDirectory', async (_, directoryPath: string): Promise<void> => {
    await fileWatcher.startWatching(directoryPath)
  })

  // Stop watching directory
  ipcMain.handle('fs:unwatchDirectory', async (): Promise<void> => {
    await fileWatcher.stopWatching()
  })

  // Handle drag and drop files
  ipcMain.handle('dragDrop:handleFiles', async (_, filePaths: string[]): Promise<ModInfo[]> => {
    const results: ModInfo[] = []
    
    for (const filePath of filePaths) {
      try {
        console.log(`[DragDrop] Processing file: ${filePath}`)
        
        if (!modService || !archiveExtractor) {
          await initializeServices()
        }
        
        if (!modService || !archiveExtractor) {
          throw new Error('Game directory not configured. Please set up the Marvel Rivals installation path in settings.')
        }

        const isArchive = SUPPORTED_EXTENSIONS.ARCHIVE_FILES.includes(
          path.extname(filePath).toLowerCase()
        )

        if (isArchive) {
          // Extract archive and install mod files
          const settings = await settingsManager.loadSettings()
          const tempDir = path.join(settingsManager.getAppDataPath(), 'temp', Date.now().toString())
          const modsDir = path.join(settings.gameDirectory, 'MarvelGame\\Marvel\\Content\\Paks\\~mods')
          
          // Extract archive
          const extractedFiles = await archiveExtractor.extractArchive(filePath, tempDir)
          const modFiles = await archiveExtractor.findModFiles(extractedFiles)
          
          if (modFiles.length === 0) {
            throw new Error('No mod files found in archive')
          }

          // Install all mod files found (.pak, .ucas, .utoc)
          const installedPaths: string[] = []
          
          for (const modFile of modFiles) {
            const targetPath = path.join(modsDir, path.basename(modFile.originalPath))
            await require('node:fs').promises.copyFile(modFile.extractedPath, targetPath)
            installedPaths.push(targetPath)
            console.log(`[DragDrop] Installed mod file: ${targetPath}`)
          }
          
          // Clean up temp files
          await archiveExtractor.cleanupTempFiles(extractedFiles)
          
          // Return mod info for the primary mod file (.pak file)
          const allMods = await modService.getAllMods()
          const pakFile = installedPaths.find(path => path.toLowerCase().endsWith('.pak'))
          const installedMod = allMods.find(mod => mod.filePath === pakFile)
          
          if (installedMod) {
            results.push(installedMod)
          }
        } else {
          // Direct .pak file installation
          const settings = await settingsManager.loadSettings()
          const modsDir = path.join(settings.gameDirectory, 'MarvelGame\\Marvel\\Content\\Paks\\~mods')
          const targetPath = path.join(modsDir, path.basename(filePath))
          
          await require('node:fs').promises.copyFile(filePath, targetPath)
          console.log(`[DragDrop] Installed direct file: ${targetPath}`)
          
          // Return mod info for the installed file
          const allMods = await modService.getAllMods()
          const installedMod = allMods.find(mod => mod.filePath === targetPath)
          
          if (installedMod) {
            results.push(installedMod)
          }
        }
      } catch (error) {
        console.error(`[DragDrop] Error processing file ${filePath}:`, error)
        throw error
      }
    }
    
    return results
  })

  // Extract archive and group mods for selection
  ipcMain.handle('dragDrop:extractAndGroup', async (_, filePath: string): Promise<ExtractedModGroups> => {
    try {
      console.log(`[DragDrop] Extracting and grouping file: ${filePath}`)
      
      if (!archiveExtractor) {
        await initializeServices()
      }
      
      if (!archiveExtractor) {
        throw new Error('Archive extractor not initialized. Please set up the Marvel Rivals installation path in settings.')
      }

      const result = await archiveExtractor.extractAndGroupMods(filePath)
      console.log(`[DragDrop] Found ${result.groups.length} mod groups, isSingleMod: ${result.isSingleMod}`)
      
      return result
    } catch (error) {
      console.error(`[DragDrop] Error extracting and grouping ${filePath}:`, error)
      throw error
    }
  })

  // Install selected mod groups
  ipcMain.handle('dragDrop:installSelected', async (_, selectedGroups: ModGroup[], tempDirectory: string): Promise<ModInfo[]> => {
    try {
      console.log(`[DragDrop] Installing ${selectedGroups.length} selected mod groups`)
      
      if (!modService || !archiveExtractor) {
        await initializeServices()
      }
      
      if (!modService || !archiveExtractor) {
        throw new Error('Services not initialized. Please set up the Marvel Rivals installation path in settings.')
      }

      const settings = await settingsManager.loadSettings()
      const modsDir = path.join(settings.gameDirectory, 'MarvelGame\\Marvel\\Content\\Paks\\~mods')
      
      // Install selected mod groups
      const installedPaths = await archiveExtractor.installSelectedModGroups(selectedGroups, modsDir)
      console.log(`[DragDrop] Installed ${installedPaths.length} files`)
      
      // Clean up all temp files (selected and ignored)
      const allGroups = selectedGroups // We'll clean up all groups later
      // Note: We should also clean up ignored groups, but we don't have them here
      // The cleanup will be handled by the full temp directory cleanup
      
      // Get mod info for installed .pak files
      const results: ModInfo[] = []
      const allMods = await modService.getAllMods()
      
      for (const group of selectedGroups) {
        const pakFileName = path.basename(group.pakFile)
        const targetPath = path.join(modsDir, pakFileName)
        const installedMod = allMods.find(mod => mod.filePath === targetPath)
        
        if (installedMod) {
          results.push(installedMod)
        }
      }
      
      console.log(`[DragDrop] Returning ${results.length} installed mod info objects`)
      return results
    } catch (error) {
      console.error(`[DragDrop] Error installing selected groups:`, error)
      throw error
    }
  })

  // Cleanup temp directory after mod selection is complete
  ipcMain.handle('dragDrop:cleanupTemp', async (_, tempDirectory: string): Promise<void> => {
    try {
      console.log(`[DragDrop] Cleaning up temp directory: ${tempDirectory}`)
      
      const rimraf = await import('rimraf')
      await rimraf.rimraf(tempDirectory)
      
      console.log(`[DragDrop] Temp directory cleaned up successfully`)
    } catch (error) {
      console.error(`[DragDrop] Error cleaning up temp directory:`, error)
      // Don't throw error for cleanup failures, just log them
    }
  })

  // Handle file buffer when drag-drop file path is not available
  // This creates a temp file and uses the regular extractAndGroup flow for proper multi-mod selection
  ipcMain.handle('dragDrop:handleFileBuffer', async (_, fileData: {
    name: string;
    buffer: ArrayBuffer;
    size: number;
    type: string;
  }): Promise<{ tempFilePath: string; shouldExtractAndGroup: boolean }> => {
    try {
      console.log(`[DragDrop] Processing file buffer: ${fileData.name} (${fileData.size} bytes)`)
      
      const tempDir = path.join(settingsManager.getAppDataPath(), 'temp', `buffer_${Date.now()}`)
      
      // Ensure temp directory exists
      await require('node:fs').promises.mkdir(tempDir, { recursive: true })

      // Write buffer to temporary file
      const tempFilePath = path.join(tempDir, fileData.name)
      const bufferData = Buffer.from(fileData.buffer)
      await require('node:fs').promises.writeFile(tempFilePath, bufferData)
      
      console.log(`[DragDrop] Buffer written to temp file: ${tempFilePath}`)

      const isArchive = SUPPORTED_EXTENSIONS.ARCHIVE_FILES.includes(
        path.extname(fileData.name).toLowerCase()
      )

      if (isArchive) {
        // Return temp file path so frontend can use extractAndGroup flow
        return {
          tempFilePath,
          shouldExtractAndGroup: true
        }
      } else if (fileData.name.toLowerCase().endsWith('.pak')) {
        // For direct .pak files, install immediately
        if (!modService) {
          await initializeServices()
        }
        
        if (!modService) {
          throw new Error('Services not initialized. Please set up the Marvel Rivals installation path in settings.')
        }

        const settings = await settingsManager.loadSettings()
        const modsDir = path.join(settings.gameDirectory, 'MarvelGame\\\\Marvel\\\\Content\\\\Paks\\\\~mods')
        const targetPath = path.join(modsDir, fileData.name)
        
        await require('node:fs').promises.copyFile(tempFilePath, targetPath)
        console.log(`[DragDrop] Buffer-installed direct file: ${targetPath}`)
        
        // Clean up temp file
        const rimraf = await import('rimraf')
        await rimraf.rimraf(tempDir)
        
        return {
          tempFilePath: targetPath,
          shouldExtractAndGroup: false
        }
      } else {
        // Clean up temp file for unsupported types
        const rimraf = await import('rimraf')
        await rimraf.rimraf(tempDir)
        throw new Error(`Unsupported file type: ${fileData.name}`)
      }
    } catch (error) {
      console.error(`[DragDrop] Error processing file buffer:`, error)
      throw error
    }
  })

  // Organize all mods to correct locations
  ipcMain.handle('mod:organizeAll', async (): Promise<OrganizationResult> => {
    console.log(`[IPC] mod:organizeAll handler called`)
    
    if (!modService) {
      console.error(`[IPC] modService not available - game directory not configured`)
      throw new Error('Game directory not configured. Please set up the Marvel Rivals installation path in settings.')
    }
    
    try {
      console.log(`[IPC] Starting mod organization process`)
      
      // Create progress callback to send updates to renderer
      const progressCallback = (progress: ModOrganizationProgress) => {
        const windows = require('electron').BrowserWindow.getAllWindows()
        windows.forEach(window => {
          window.webContents.send('mod:organizationProgress', progress)
        })
      }
      
      const result = await modService.organizeAllMods(true, progressCallback)
      console.log(`[IPC] Organization complete: ${result.movedMods} moved, ${result.errorCount} errors`)
      
      return result
    } catch (error) {
      console.error(`[IPC] Error in mod:organizeAll handler:`, error)
      throw error
    }
  })

  // Get all mods (with optional organization)
  ipcMain.handle('mod:getAllWithOrganization', async (_, organizeFirst: boolean = false): Promise<ModInfo[]> => {
    if (!modService) {
      await initializeServices()
    }
    
    // Return empty array if service not initialized (graceful degradation)
    if (!modService) {
      console.warn('Mod service not initialized - game directory not configured')
      return []
    }
    
    try {
      // Optionally organize first
      if (organizeFirst) {
        console.log('[IPC] Running organization before getting mods')
        
        // Create progress callback for organization
        const progressCallback = (progress: ModOrganizationProgress) => {
          const windows = require('electron').BrowserWindow.getAllWindows()
          windows.forEach(window => {
            window.webContents.send('mod:organizationProgress', progress)
          })
        }
        
        await modService.organizeAllMods(true, progressCallback)
      }
      
      return modService.getAllMods()
    } catch (error) {
      console.error('[IPC] Error in mod:getAllWithOrganization:', error)
      throw error
    }
  })
}

// File watcher event forwarding
fileWatcher.on('fileAdded', (filePath: string) => {
  // Notify renderer of new mod file
  const windows = require('electron').BrowserWindow.getAllWindows()
  windows.forEach(window => {
    window.webContents.send('mods:fileAdded', filePath)
  })
})

fileWatcher.on('fileRemoved', (filePath: string) => {
  // Notify renderer of removed mod file
  const windows = require('electron').BrowserWindow.getAllWindows()
  windows.forEach(window => {
    window.webContents.send('mods:fileRemoved', filePath)
  })
})

fileWatcher.on('fileChanged', (filePath: string) => {
  // Notify renderer of changed mod file
  const windows = require('electron').BrowserWindow.getAllWindows()
  windows.forEach(window => {
    window.webContents.send('mods:fileChanged', filePath)
  })
})

// General file change event forwarding for useFileWatcher hook
const sendFileChangeEvent = (type: string, filePath: string) => {
  const windows = require('electron').BrowserWindow.getAllWindows()
  windows.forEach(window => {
    window.webContents.send('fs:fileChange', {
      type,
      path: filePath,
      timestamp: new Date().toISOString()
    })
  })
}

// Forward all file events to the general handler
fileWatcher.on('fileAdded', (filePath: string) => {
  sendFileChangeEvent('add', filePath)
})

fileWatcher.on('fileRemoved', (filePath: string) => {
  sendFileChangeEvent('unlink', filePath)
})

fileWatcher.on('fileChanged', (filePath: string) => {
  sendFileChangeEvent('change', filePath)
})