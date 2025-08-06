import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

import type { registerRoute } from 'lib/electron-router-dom'

export type BrowserWindowOrNull = Electron.BrowserWindow | null

type Route = Parameters<typeof registerRoute>[0]

export interface WindowProps extends Electron.BrowserWindowConstructorOptions {
  id: Route['id']
  query?: Route['query']
}

export interface WindowCreationByIPC {
  channel: string
  window(): BrowserWindowOrNull
  callback(window: BrowserWindow, event: IpcMainInvokeEvent): void
}

// ===== Marvel Rivals Mod Manager Types =====

export type ModCategory = 'UI' | 'Audio' | 'Skins' | 'Gameplay'
export type ViewMode = 'grid' | 'list'
export type Theme = 'dark' | 'light'
export type SortBy = 'name' | 'category' | 'character' | 'installDate' | 'lastModified' | 'size'
export type SortOrder = 'asc' | 'desc'

export type Character = 
  | 'Adam' | 'Black Panther' | 'Black Widow' | 'Bruce Banner' | 'Captain America'
  | 'Cloak & Dagger' | 'Doctor Strange' | 'Emma Frost' | 'Groot' | 'Hawkeye'
  | 'Hela' | 'Hulk' | 'Human Torch' | 'Invisible Woman' | 'Iron Fist'
  | 'Iron Man' | 'Jeff' | 'Loki' | 'Luna Snow' | 'Magik'
  | 'Magneto' | 'Mantis' | 'Moon Knight' | 'Mr. Fantastic' | 'Namor'
  | 'Peni Parker' | 'Phoenix' | 'Psylocke' | 'Punisher' | 'Rocket Raccoon'
  | 'Scarlet Witch' | 'Spider-Man' | 'Squirrel Girl' | 'Star-Lord' | 'Storm'
  | 'The Thing' | 'Thor' | 'Ultron' | 'Venom' | 'Winter Soldier' | 'Wolverine'

export interface ModMetadata {
  title: string
  description: string
  author?: string
  version?: string
  tags: string[]
  category: ModCategory
  character?: Character
  customThumbnail?: string
  createdAt: Date
  updatedAt: Date
}

export interface ModInfo {
  id: string
  name: string
  category: ModCategory
  character?: Character
  enabled: boolean
  filePath: string
  thumbnailPath?: string
  metadata: ModMetadata
  fileSize: number
  installDate: Date
  lastModified: Date
  originalFileName: string
  extractedPath?: string
  associatedFiles?: string[]
}

export interface AppSettings {
  gameDirectory: string
  theme: Theme
  defaultViewMode: ViewMode
  sortBy: SortBy
  sortOrder: SortOrder
  autoOrganize: boolean
  autoDetectCategory: boolean
  autoDetectCharacter: boolean
  showThumbnails: boolean
  enableAnimations: boolean
  checkForUpdates: boolean
  firstLaunch: boolean
}

export interface ModInstallProgress {
  id: string
  fileName: string
  progress: number
  status: 'extracting' | 'organizing' | 'validating' | 'complete' | 'error'
  error?: string
}

export interface ModOrganizationProgress {
  currentFile: string
  current: number
  total: number
  status: 'scanning' | 'organizing' | 'complete' | 'error'
  movedCount: number
  errorCount: number
  errors: string[]
}

export interface OrganizationResult {
  totalMods: number
  movedMods: number
  errorCount: number
  errors: string[]
  duration: number
}

// Multi-mod selection types
export interface ModGroup {
  id: string
  name: string  // Primary .pak file name without extension
  pakFile: string  // Full path to .pak file
  associatedFiles: string[]  // Full paths to .ucas, .utoc files
  size: number  // Total size of all files
  folder?: string  // Parent folder if organized in directories
}

export interface ModSelectionResult {
  selectedGroups: ModGroup[]
  ignoredGroups: ModGroup[]
}

export interface ExtractedModGroups {
  groups: ModGroup[]
  tempDirectory: string
  isSingleMod: boolean
}

export interface GameDirectoryInfo {
  path: string
  found: boolean
  modsFolderExists: boolean
  writable: boolean
}

export interface CategoryStats {
  category: ModCategory
  count: number
  enabled: number
  disabled: number
}

export interface CharacterStats {
  character: Character
  count: number
  enabled: number
  disabled: number
}

export interface AppStats {
  totalMods: number
  enabledMods: number
  disabledMods: number
  categories: CategoryStats[]
  characters: CharacterStats[]
  totalSize: number
}

// IPC Channel Types
export interface IPCChannels {
  // Mod Management
  'mod:install': (filePath: string) => Promise<ModInfo>
  'mod:enable': (modId: string, enabled: boolean) => Promise<void>
  'mod:delete': (modId: string) => Promise<void>
  'mod:getAll': () => Promise<ModInfo[]>
  'mod:updateMetadata': (modId: string, metadata: Partial<ModMetadata>) => Promise<void>
  'mod:reorganize': (modId: string) => Promise<void>
  'mod:getAssociatedFiles': (modId: string) => Promise<string[]>
  
  // File System
  'fs:selectModFiles': () => Promise<string[]>
  'fs:watchMods': () => Promise<void>
  
  // System
  'system:detectGameDir': () => Promise<GameDirectoryInfo>
  'system:getSettings': () => Promise<AppSettings>
  'system:saveSettings': (settings: Partial<AppSettings>) => Promise<void>
  'system:getStats': () => Promise<AppStats>
  'system:openExternal': (url: string) => Promise<void>
  'system:openFolder': (path: string) => Promise<void>
  'system:selectDirectory': (title?: string) => Promise<string | null>
  'system:selectModDirectory': (title?: string) => Promise<string | null>
  'system:checkFolderPermissions': (folderPath: string) => Promise<{
    exists: boolean
    readable: boolean
    writable: boolean
    isDirectory: boolean
  }>
  'system:createDirectory': (dirPath: string) => Promise<boolean>
  'system:getFolderInfo': (folderPath: string) => Promise<{
    exists: boolean
    size: number
    fileCount: number
    folderCount: number
    lastModified: string
    isEmpty: boolean
  }>
  'system:validateModPath': (folderPath: string) => Promise<{
    isValid: boolean
    reason?: string
    suggestions?: string[]
  }>
  
  // Thumbnails
  'thumbnail:save': (modId: string, imagePath: string) => Promise<string>
  'thumbnail:saveFromUrl': (modId: string, imageUrl: string) => Promise<string>
  'thumbnail:delete': (modId: string) => Promise<void>
}

// Context Types
export interface ModContextType {
  mods: ModInfo[]
  filteredMods: ModInfo[]
  selectedMod: ModInfo | null
  searchQuery: string
  selectedCategory: ModCategory | 'All'
  selectedCharacter: Character | 'All'
  viewMode: ViewMode
  sortBy: SortBy
  sortOrder: SortOrder
  isLoading: boolean
  error: string | null
  
  // Actions
  setSelectedMod: (mod: ModInfo | null) => void
  setSearchQuery: (query: string) => void
  setSelectedCategory: (category: ModCategory | 'All') => void
  setSelectedCharacter: (character: Character | 'All') => void
  setViewMode: (mode: ViewMode) => void
  setSorting: (sortBy: SortBy, order?: SortOrder) => void
  refreshMods: () => Promise<void>
  installMod: (filePath: string) => Promise<void>
  toggleMod: (modId: string) => Promise<void>
  deleteMod: (modId: string) => Promise<void>
  updateModMetadata: (modId: string, metadata: Partial<ModMetadata>) => Promise<void>
}

export interface SettingsContextType {
  settings: AppSettings
  gameDirectoryInfo: GameDirectoryInfo
  isLoading: boolean
  error: string | null
  
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>
  detectGameDirectory: () => Promise<void>
  openGameDirectory: () => Promise<void>
  openModsDirectory: () => Promise<void>
}

export interface UIContextType {
  theme: Theme
  showDetailsPanel: boolean
  showSettingsModal: boolean
  showMetadataEditor: boolean
  installProgress: ModInstallProgress[]
  
  setTheme: (theme: Theme) => void
  setShowDetailsPanel: (show: boolean) => void
  setShowSettingsModal: (show: boolean) => void
  setShowMetadataEditor: (show: boolean) => void
  addInstallProgress: (progress: ModInstallProgress) => void
  updateInstallProgress: (id: string, progress: Partial<ModInstallProgress>) => void
  removeInstallProgress: (id: string) => void
}
