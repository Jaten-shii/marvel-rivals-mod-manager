import { contextBridge, ipcRenderer } from 'electron'

import type { 
  ModInfo, 
  ModMetadata, 
  AppSettings, 
  GameDirectoryInfo, 
  AppStats,
  ModInstallProgress,
  ModOrganizationProgress,
  OrganizationResult
} from 'shared/types'

// Import changelog types
export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export interface ChangelogData {
  entries: ChangelogEntry[]
  latestVersion: string
}

// Import update types
export interface UpdateInfo {
  available: boolean
  currentVersion: string
  latestVersion: string
  releaseNotes?: string
  downloadUrl?: string
  publishedAt?: string
}

declare global {
  interface Window {
    electronAPI: typeof ModManagerAPI
  }
}

const ModManagerAPI = {
  // ===== Mod Management =====
  mod: {
    // Get all mods
    getAll: (): Promise<ModInfo[]> => ipcRenderer.invoke('mod:getAll'),
    
    // Install mod from file path
    install: (filePath: string): Promise<ModInfo> => ipcRenderer.invoke('mod:install', filePath),
    
    // Enable or disable mod
    enable: (modId: string, enabled: boolean): Promise<void> => 
      ipcRenderer.invoke('mod:enable', modId, enabled),
    
    // Delete mod
    delete: (modId: string): Promise<void> => ipcRenderer.invoke('mod:delete', modId),
    
    // Update mod metadata
    updateMetadata: (modId: string, metadata: Partial<ModMetadata>): Promise<ModInfo> => 
      ipcRenderer.invoke('mod:updateMetadata', modId, metadata),
    
    // Reorganize mod based on metadata
    reorganize: (modId: string): Promise<void> => ipcRenderer.invoke('mod:reorganize', modId),
    
    // Get associated files for a mod (.pak, .ucas, .utoc)
    getAssociatedFiles: (modId: string): Promise<string[]> => 
      ipcRenderer.invoke('mod:getAssociatedFiles', modId),
    
    // Organize all mods to correct locations
    organizeAll: (): Promise<OrganizationResult> => ipcRenderer.invoke('mod:organizeAll'),
    
    // Get all mods with optional organization first
    getAllWithOrganization: (organizeFirst?: boolean): Promise<ModInfo[]> => 
      ipcRenderer.invoke('mod:getAllWithOrganization', organizeFirst),
  },

  // ===== File System =====
  fs: {
    // Show file selection dialog
    selectModFiles: (): Promise<string[]> => ipcRenderer.invoke('fs:selectModFiles'),
    
    // Show file selection dialog with custom options
    selectFiles: (options: { 
      filters?: Array<{ name: string; extensions: string[] }>; 
      properties?: string[] 
    }): Promise<string[]> => ipcRenderer.invoke('fs:selectFiles', options),
    
    // Open folder in file explorer (removed duplicate - using system:openFolder)
    
    // Start file watching
    watchMods: (): Promise<void> => ipcRenderer.invoke('fs:watchMods'),
    
    // Check if path exists
    exists: (path: string): Promise<boolean> => ipcRenderer.invoke('fs:exists', path),
    
    // Watch specific directory for changes
    watchDirectory: (path: string): Promise<void> => ipcRenderer.invoke('fs:watchDirectory', path),
    
    // Stop watching directory
    unwatchDirectory: (): Promise<void> => ipcRenderer.invoke('fs:unwatchDirectory'),
  },

  // ===== System Operations =====
  system: {
    // Get application settings
    getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('system:getSettings'),
    
    // Check if application is properly configured
    isConfigured: (): Promise<boolean> => ipcRenderer.invoke('system:isConfigured'),
    
    // Save application settings
    saveSettings: (settings: Partial<AppSettings>): Promise<void> => 
      ipcRenderer.invoke('system:saveSettings', settings),
    
    // Auto-detect game directory
    detectGameDir: (): Promise<GameDirectoryInfo> => ipcRenderer.invoke('system:detectGameDir'),
    
    // Manually select game directory
    selectGameDir: (): Promise<string | null> => ipcRenderer.invoke('system:selectGameDir'),
    
    // Get application statistics
    getStats: (): Promise<AppStats> => ipcRenderer.invoke('system:getStats'),
    
    // Open external URL
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('system:openExternal', url),
    
    // Open folder in file explorer
    openFolder: (path: string): Promise<void> => ipcRenderer.invoke('system:openFolder', path),
    
    // Select directory manually
    selectDirectory: (title?: string): Promise<string | null> => ipcRenderer.invoke('system:selectDirectory', title),
    
    // Select mod directory with validation
    selectModDirectory: (title?: string): Promise<string | null> => ipcRenderer.invoke('system:selectModDirectory', title),
    
    // Check folder permissions and properties
    checkFolderPermissions: (folderPath: string): Promise<{
      exists: boolean
      readable: boolean
      writable: boolean
      isDirectory: boolean
    }> => ipcRenderer.invoke('system:checkFolderPermissions', folderPath),
    
    // Create directory with parents
    createDirectory: (dirPath: string): Promise<boolean> => ipcRenderer.invoke('system:createDirectory', dirPath),
    
    // Get folder metadata and contents summary
    getFolderInfo: (folderPath: string): Promise<{
      exists: boolean
      size: number
      fileCount: number
      folderCount: number
      lastModified: string
      isEmpty: boolean
    }> => ipcRenderer.invoke('system:getFolderInfo', folderPath),
    
    // Validate if path is safe for mod operations
    validateModPath: (folderPath: string): Promise<{
      isValid: boolean
      reason?: string
      suggestions?: string[]
    }> => ipcRenderer.invoke('system:validateModPath', folderPath),
    
    // Get app data paths
    getAppDataPaths: (): Promise<{
      appData: string
      metadata: string
      thumbnails: string
      logs: string
    }> => ipcRenderer.invoke('system:getAppDataPaths'),
    
    // Reset settings to defaults
    resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('system:resetSettings'),
    
    // Export settings to file
    exportSettings: (): Promise<void> => ipcRenderer.invoke('system:exportSettings'),
    
    // Import settings from file
    importSettings: (): Promise<AppSettings> => ipcRenderer.invoke('system:importSettings'),
    
    // Check for application updates
    checkForUpdates: (): Promise<UpdateInfo> => ipcRenderer.invoke('system:checkForUpdates'),
    
    // Get system information
    getSystemInfo: (): Promise<any> => ipcRenderer.invoke('system:getSystemInfo'),
    
    // Clear application cache
    clearCache: (): Promise<void> => ipcRenderer.invoke('system:clearCache'),
    
    // Restart application
    restart: (): Promise<void> => ipcRenderer.invoke('system:restart'),

    // Get character icon URL
    getCharacterIconUrl: (characterName: string): Promise<string> => 
      ipcRenderer.invoke('system:getCharacterIconUrl', characterName),

    // Check if character icon exists
    characterIconExists: (characterName: string): Promise<boolean> => 
      ipcRenderer.invoke('system:characterIconExists', characterName),

    // Get available character icons
    getAvailableCharacterIcons: (): Promise<string[]> => 
      ipcRenderer.invoke('system:getAvailableCharacterIcons'),

    // Get asset debug info
    getAssetDebugInfo: (): Promise<any> => 
      ipcRenderer.invoke('system:getAssetDebugInfo'),
    
    // Get file URL using app:// protocol
    getFileUrl: (category: string, fileName: string): Promise<string> =>
      ipcRenderer.invoke('system:getFileUrl', category, fileName),
    
    // Get thumbnail URL
    getThumbnailUrl: (fileName: string): Promise<string> =>
      ipcRenderer.invoke('system:getThumbnailUrl', fileName),
      
    // Get character icon URL using app:// protocol
    getCharacterIconProtocolUrl: (characterName: string): Promise<string> =>
      ipcRenderer.invoke('system:getCharacterIconProtocolUrl', characterName),
  },

  // ===== Thumbnail Management =====
  thumbnail: {
    // Save thumbnail from local file
    save: (modId: string, imagePath: string, originalFileName?: string): Promise<string> => 
      ipcRenderer.invoke('thumbnail:save', modId, imagePath, originalFileName),
    
    // Save thumbnail from URL
    saveFromUrl: (modId: string, imageUrl: string, originalFileName?: string): Promise<string> => 
      ipcRenderer.invoke('thumbnail:saveFromUrl', modId, imageUrl, originalFileName),
    
    // Delete thumbnail
    delete: (modId: string, originalFileName?: string): Promise<void> => 
      ipcRenderer.invoke('thumbnail:delete', modId, originalFileName),
    
    // Get thumbnail path
    getPath: (modId: string, originalFileName?: string): Promise<string | null> => 
      ipcRenderer.invoke('thumbnail:getPath', modId, originalFileName),
    
    // List all thumbnails
    listAll: (): Promise<{ modId: string; path: string }[]> => 
      ipcRenderer.invoke('thumbnail:listAll'),
    
    // Cleanup orphaned thumbnails
    cleanup: (validModIds: string[]): Promise<number> => 
      ipcRenderer.invoke('thumbnail:cleanup', validModIds),
  },

  // ===== Changelog Management =====
  changelog: {
    // Get full changelog data
    getChangelog: (): Promise<ChangelogData> => ipcRenderer.invoke('changelog:getChangelog'),
    
    // Get current app version
    getAppVersion: (): Promise<string> => ipcRenderer.invoke('changelog:getAppVersion'),
    
    // Get latest changelog entry
    getLatestEntry: (): Promise<ChangelogEntry | null> => ipcRenderer.invoke('changelog:getLatestEntry'),
  },

  // ===== Event Listeners =====
  events: {
    // Listen for mod file changes
    onModsChanged: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('mods:fileAdded', handler)
      ipcRenderer.on('mods:fileRemoved', handler)
      ipcRenderer.on('mods:fileChanged', handler)
      
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('mods:fileAdded', handler)
        ipcRenderer.removeListener('mods:fileRemoved', handler)
        ipcRenderer.removeListener('mods:fileChanged', handler)
      }
    },
    
    // Listen for specific mod events
    onModFileAdded: (callback: (filePath: string) => void) => {
      const handler = (_: any, filePath: string) => callback(filePath)
      ipcRenderer.on('mods:fileAdded', handler)
      return () => ipcRenderer.removeListener('mods:fileAdded', handler)
    },
    
    onModFileRemoved: (callback: (filePath: string) => void) => {
      const handler = (_: any, filePath: string) => callback(filePath)
      ipcRenderer.on('mods:fileRemoved', handler)
      return () => ipcRenderer.removeListener('mods:fileRemoved', handler)
    },
    
    onModFileChanged: (callback: (filePath: string) => void) => {
      const handler = (_: any, filePath: string) => callback(filePath)
      ipcRenderer.on('mods:fileChanged', handler)
      return () => ipcRenderer.removeListener('mods:fileChanged', handler)
    },
    
    // Listen for install progress
    onInstallProgress: (callback: (progress: ModInstallProgress) => void) => {
      const handler = (_: any, progress: ModInstallProgress) => callback(progress)
      ipcRenderer.on('mod:installProgress', handler)
      return () => ipcRenderer.removeListener('mod:installProgress', handler)
    },
    
    // Listen for organization progress
    onOrganizationProgress: (callback: (progress: ModOrganizationProgress) => void) => {
      const handler = (_: any, progress: ModOrganizationProgress) => callback(progress)
      ipcRenderer.on('mod:organizationProgress', handler)
      return () => ipcRenderer.removeListener('mod:organizationProgress', handler)
    },
    
    // Listen for startup organization completion
    onStartupComplete: (callback: (result: OrganizationResult) => void) => {
      const handler = (_: any, result: OrganizationResult) => callback(result)
      ipcRenderer.on('app:startupComplete', handler)
      return () => ipcRenderer.removeListener('app:startupComplete', handler)
    },
    
    // Listen for file system changes
    onFileChange: (callback: (event: { type: string; path: string; timestamp: string }) => void) => {
      const handler = (_: any, event: { type: string; path: string; timestamp: string }) => callback(event)
      ipcRenderer.on('fs:fileChange', handler)
      return () => ipcRenderer.removeListener('fs:fileChange', handler)
    },
  },

  // ===== Drag and Drop Support =====
  dragDrop: {
    // Handle dropped files
    handleDroppedFiles: async (files: FileList): Promise<ModInfo[]> => {
      const filePaths: string[] = []
      
      for (const file of Array.from(files)) {
        // In Electron, File objects from drag & drop should have a path property
        const filePath = (file as any).path
        
        if (!filePath) {
          // If no path available, we can't process the file
          console.error('File path not available for:', file.name)
          throw new Error(`Cannot access file path for: ${file.name}. Please use the "Add Mod" button instead.`)
        }
        
        filePaths.push(filePath)
      }
      
      // Use the dedicated drag drop handler
      return ipcRenderer.invoke('dragDrop:handleFiles', filePaths)
    },

    // Handle dropped file using buffer when path is not available
    handleFileBuffer: (fileData: {
      name: string;
      buffer: ArrayBuffer;
      size: number;
      type: string;
    }): Promise<{ tempFilePath: string; shouldExtractAndGroup: boolean }> => 
      ipcRenderer.invoke('dragDrop:handleFileBuffer', fileData),

    // Extract archive and group mods for selection
    extractAndGroup: (filePath: string) => 
      ipcRenderer.invoke('dragDrop:extractAndGroup', filePath),
    
    // Install selected mod groups
    installSelected: (selectedGroups: any[], tempDirectory: string) => 
      ipcRenderer.invoke('dragDrop:installSelected', selectedGroups, tempDirectory),
    
    // Cleanup temp directory
    cleanupTemp: (tempDirectory: string) => 
      ipcRenderer.invoke('dragDrop:cleanupTemp', tempDirectory),
  },

  // ===== Utility Functions =====
  utils: {
    // Get platform information
    platform: process.platform,
    
    // Check if development mode
    isDev: process.env.NODE_ENV === 'development',
    
    // Get app version
    getVersion: (): Promise<string> => ipcRenderer.invoke('system:getSystemInfo').then(info => info.appVersion),
    
    // Format file size
    formatFileSize: (bytes: number): string => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
    },
    
    // Format date
    formatDate: (date: Date | string): string => {
      const d = new Date(date)
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
    },
    
    // Validate file extension
    isValidModFile: (fileName: string): boolean => {
      const validExtensions = ['.pak', '.zip', '.rar', '.7z']
      const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
      return validExtensions.includes(ext)
    },
  },
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', ModManagerAPI)
