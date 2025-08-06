import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Theme, ViewMode } from 'shared/types'

interface AppSettings {
  // Game Configuration
  gameDirectory: string
  modDirectory: string
  autoDetectGameDir: boolean
  
  // UI Preferences
  theme: Theme
  defaultViewMode: ViewMode
  sidebarCollapsed: boolean
  
  // Behavior Settings
  autoRefreshMods: boolean
  confirmDeletion: boolean
  backupMods: boolean
  
  // Advanced Settings
  maxConcurrentInstalls: number
  compressionLevel: number
  validateModIntegrity: boolean
  
  // Window Settings
  windowBounds: {
    width: number
    height: number
    x?: number
    y?: number
    maximized: boolean
  }
}

interface SettingsContextState {
  settings: AppSettings
  isLoading: boolean
  hasUnsavedChanges: boolean
  error: string | null
}

interface SettingsContextActions {
  // Settings Management
  updateSettings: (updates: Partial<AppSettings>) => void
  saveSettings: () => Promise<void>
  resetSettings: () => Promise<void>
  detectGameDirectory: () => Promise<string | null>
  
  // Specific Setting Updates
  setGameDirectory: (directory: string) => void
  setTheme: (theme: Theme) => void
  setViewMode: (viewMode: ViewMode) => void
  
  // Utilities
  clearError: () => void
}

type SettingsContextValue = SettingsContextState & SettingsContextActions

const defaultSettings: AppSettings = {
  // Game Configuration
  gameDirectory: '',
  modDirectory: '',
  autoDetectGameDir: true,
  
  // UI Preferences
  theme: 'dark',
  defaultViewMode: 'grid',
  sidebarCollapsed: false,
  
  // Behavior Settings
  autoRefreshMods: true,
  confirmDeletion: true,
  backupMods: true,
  
  // Advanced Settings
  maxConcurrentInstalls: 3,
  compressionLevel: 6,
  validateModIntegrity: true,
  
  // Window Settings
  windowBounds: {
    width: 1200,
    height: 800,
    maximized: false,
  },
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettingsContext() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider')
  }
  return context
}

interface SettingsProviderProps {
  children: React.ReactNode
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  // Auto-save when changes are made (with debounce)
  useEffect(() => {
    if (!hasUnsavedChanges || isLoading) return

    const timeoutId = setTimeout(() => {
      saveSettings()
    }, 1000) // Auto-save after 1 second of inactivity

    return () => clearTimeout(timeoutId)
  }, [hasUnsavedChanges, isLoading])

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const savedSettings = await window.electronAPI.system.getSettings()
      
      // Merge with defaults to ensure all properties exist
      const mergedSettings = { ...defaultSettings, ...savedSettings }
      setSettings(mergedSettings)
      
      // Auto-detect game directory if not set and auto-detection is enabled
      if (mergedSettings.autoDetectGameDir && !mergedSettings.gameDirectory) {
        const detectedDir = await detectGameDirectory()
        if (detectedDir) {
          setSettings(prev => ({
            ...prev,
            gameDirectory: detectedDir,
            modDirectory: `${detectedDir}\\MarvelGame\\Marvel\\Content\\Paks\\~mods`,
          }))
          setHasUnsavedChanges(true)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings'
      setError(errorMessage)
      console.error('Error loading settings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
    setHasUnsavedChanges(true)
    setError(null)
  }, [])

  const saveSettings = useCallback(async () => {
    try {
      setError(null)
      
      await window.electronAPI.system.saveSettings(settings)
      setHasUnsavedChanges(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings'
      setError(errorMessage)
      console.error('Error saving settings:', err)
    }
  }, [settings])

  const resetSettings = useCallback(async () => {
    try {
      setError(null)
      
      setSettings(defaultSettings)
      await window.electronAPI.system.saveSettings(defaultSettings)
      setHasUnsavedChanges(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings'
      setError(errorMessage)
      console.error('Error resetting settings:', err)
    }
  }, [])

  const detectGameDirectory = useCallback(async (): Promise<string | null> => {
    try {
      setError(null)
      
      const gameInfo = await window.electronAPI.system.detectGameDir()
      return gameInfo.found ? gameInfo.path : null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to detect game directory'
      setError(errorMessage)
      console.error('Error detecting game directory:', err)
      return null
    }
  }, [])

  const setGameDirectory = useCallback((directory: string) => {
    const modDirectory = directory ? `${directory}\\MarvelGame\\Marvel\\Content\\Paks\\~mods` : ''
    updateSettings({ 
      gameDirectory: directory,
      modDirectory,
    })
  }, [updateSettings])

  const setTheme = useCallback((theme: Theme) => {
    updateSettings({ theme })
  }, [updateSettings])

  const setViewMode = useCallback((viewMode: ViewMode) => {
    updateSettings({ defaultViewMode: viewMode })
  }, [updateSettings])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const contextValue: SettingsContextValue = {
    // State
    settings,
    isLoading,
    hasUnsavedChanges,
    error,
    
    // Actions
    updateSettings,
    saveSettings,
    resetSettings,
    detectGameDirectory,
    setGameDirectory,
    setTheme,
    setViewMode,
    clearError,
  }

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  )
}