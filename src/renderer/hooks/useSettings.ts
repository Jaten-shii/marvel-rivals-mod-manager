import { useCallback } from 'react'
import { useSettingsContext } from '../contexts/SettingsContext'
import { useUIContext } from '../contexts/UIContext'
import type { Theme, ViewMode } from 'shared/types'

/**
 * Custom hook for settings management operations
 * Provides high-level settings operations with UI integration
 */
export function useSettings() {
  const settingsContext = useSettingsContext()
  const uiContext = useUIContext()

  // Enhanced settings operations with UI feedback
  const saveSettingsWithFeedback = useCallback(async () => {
    try {
      await settingsContext.saveSettings()
      
      uiContext.showNotification({
        type: 'success',
        title: 'Settings saved',
        message: 'Your settings have been saved successfully.',
        duration: 2000,
      })
    } catch (error) {
      uiContext.showNotification({
        type: 'error',
        title: 'Failed to save settings',
        message: error instanceof Error ? error.message : 'An error occurred while saving settings',
      })
    }
  }, [settingsContext, uiContext])

  const resetSettingsWithConfirmation = useCallback(async () => {
    const dialogId = uiContext.showDialog({
      type: 'warning',
      title: 'Reset Settings',
      message: 'Are you sure you want to reset all settings to their default values? This action cannot be undone.',
      confirmText: 'Reset',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await settingsContext.resetSettings()
          
          uiContext.showNotification({
            type: 'success',
            title: 'Settings reset',
            message: 'All settings have been reset to their default values.',
          })
        } catch (error) {
          uiContext.showNotification({
            type: 'error',
            title: 'Failed to reset settings',
            message: error instanceof Error ? error.message : 'An error occurred while resetting settings',
          })
        }
        uiContext.closeDialog(dialogId)
      },
      onCancel: () => {
        uiContext.closeDialog(dialogId)
      },
    })
  }, [settingsContext, uiContext])

  const selectGameDirectoryWithDialog = useCallback(async () => {
    try {
      const selectedPath = await window.electronAPI.fs.selectDirectory({
        title: 'Select Marvel Rivals Installation Directory',
        defaultPath: settingsContext.settings.gameDirectory || 'C:\\Program Files (x86)\\Steam\\steamapps\\common',
      })
      
      if (selectedPath) {
        // Validate that this looks like a Marvel Rivals installation
        const isValidGameDir = await window.electronAPI.fs.exists(`${selectedPath}\\MarvelGame\\Binaries\\Win64\\MarvelGame.exe`)
        
        if (isValidGameDir) {
          settingsContext.setGameDirectory(selectedPath)
          
          uiContext.showNotification({
            type: 'success',
            title: 'Game directory updated',
            message: `Marvel Rivals installation found at: ${selectedPath}`,
          })
        } else {
          uiContext.showNotification({
            type: 'warning',
            title: 'Invalid game directory',
            message: 'The selected directory does not appear to contain a Marvel Rivals installation. Please select the correct game folder.',
          })
        }
      }
    } catch (error) {
      uiContext.showNotification({
        type: 'error',
        title: 'Failed to select directory',
        message: error instanceof Error ? error.message : 'Could not open directory selection dialog',
      })
    }
  }, [settingsContext, uiContext])

  const autoDetectGameDirectory = useCallback(async () => {
    try {
      uiContext.showNotification({
        type: 'info',
        title: 'Detecting game directory...',
        message: 'Please wait while we search for your Marvel Rivals installation.',
        duration: 0,
      })
      
      const detectedPath = await settingsContext.detectGameDirectory()
      
      uiContext.clearAllNotifications()
      
      if (detectedPath) {
        settingsContext.setGameDirectory(detectedPath)
        
        uiContext.showNotification({
          type: 'success',
          title: 'Game directory detected',
          message: `Marvel Rivals installation found at: ${detectedPath}`,
        })
      } else {
        uiContext.showNotification({
          type: 'warning',
          title: 'Game directory not found',
          message: 'Could not automatically detect Marvel Rivals installation. Please select the directory manually.',
          action: {
            label: 'Select Manually',
            onClick: selectGameDirectoryWithDialog,
          },
        })
      }
    } catch (error) {
      uiContext.clearAllNotifications()
      uiContext.showNotification({
        type: 'error',
        title: 'Detection failed',
        message: error instanceof Error ? error.message : 'Failed to detect game directory',
      })
    }
  }, [settingsContext, uiContext, selectGameDirectoryWithDialog])

  // Theme management with UI synchronization
  const setThemeAndSync = useCallback((theme: Theme) => {
    settingsContext.setTheme(theme)
    uiContext.setTheme(theme)
  }, [settingsContext, uiContext])

  const cycleTheme = useCallback(() => {
    const themes: Theme[] = ['dark', 'light', 'glass']
    const currentIndex = themes.indexOf(settingsContext.settings.theme)
    const nextIndex = (currentIndex + 1) % themes.length
    const nextTheme = themes[nextIndex]
    
    setThemeAndSync(nextTheme)
  }, [settingsContext.settings.theme, setThemeAndSync])

  // View mode management with UI synchronization
  const setViewModeAndSync = useCallback((viewMode: ViewMode) => {
    settingsContext.setViewMode(viewMode)
    uiContext.setViewMode(viewMode)
  }, [settingsContext, uiContext])

  // Window state management
  const updateWindowBounds = useCallback((bounds: Partial<typeof settingsContext.settings.windowBounds>) => {
    settingsContext.updateSettings({
      windowBounds: {
        ...settingsContext.settings.windowBounds,
        ...bounds,
      },
    })
  }, [settingsContext])

  // Validation helpers
  const validateGameDirectory = useCallback(async (directory: string): Promise<boolean> => {
    try {
      const marvelGameExists = await window.electronAPI.fs.exists(`${directory}\\MarvelGame\\Binaries\\Win64\\MarvelGame.exe`)
      const contentPaksExists = await window.electronAPI.fs.exists(`${directory}\\MarvelGame\\Marvel\\Content\\Paks`)
      
      return marvelGameExists && contentPaksExists
    } catch {
      return false
    }
  }, [])

  const getGameDirectoryStatus = useCallback(async () => {
    if (!settingsContext.settings.gameDirectory) {
      return { isValid: false, message: 'No game directory set' }
    }
    
    const isValid = await validateGameDirectory(settingsContext.settings.gameDirectory)
    
    if (isValid) {
      return { isValid: true, message: 'Valid Marvel Rivals installation' }
    } else {
      return { isValid: false, message: 'Invalid game directory - Marvel Rivals not found' }
    }
  }, [settingsContext.settings.gameDirectory, validateGameDirectory])

  // Settings categories for UI organization
  const getSettingsCategories = useCallback(() => {
    return {
      game: {
        title: 'Game Configuration',
        settings: ['gameDirectory', 'modDirectory', 'autoDetectGameDir'],
      },
      appearance: {
        title: 'Appearance',
        settings: ['theme', 'defaultViewMode', 'sidebarCollapsed'],
      },
      behavior: {
        title: 'Behavior',
        settings: ['autoRefreshMods', 'confirmDeletion', 'backupMods'],
      },
      advanced: {
        title: 'Advanced',
        settings: ['maxConcurrentInstalls', 'compressionLevel', 'validateModIntegrity'],
      },
    }
  }, [])

  return {
    // State
    settings: settingsContext.settings,
    isLoading: settingsContext.isLoading,
    hasUnsavedChanges: settingsContext.hasUnsavedChanges,
    error: settingsContext.error,
    
    // Basic operations
    updateSettings: settingsContext.updateSettings,
    saveSettings: settingsContext.saveSettings,
    resetSettings: settingsContext.resetSettings,
    detectGameDirectory: settingsContext.detectGameDirectory,
    setGameDirectory: settingsContext.setGameDirectory,
    setTheme: settingsContext.setTheme,
    setViewMode: settingsContext.setViewMode,
    clearError: settingsContext.clearError,
    
    // Enhanced operations with UI feedback
    saveSettingsWithFeedback,
    resetSettingsWithConfirmation,
    selectGameDirectoryWithDialog,
    autoDetectGameDirectory,
    
    // Theme and view mode management with UI sync
    setThemeAndSync,
    cycleTheme,
    setViewModeAndSync,
    
    // Window management
    updateWindowBounds,
    
    // Validation
    validateGameDirectory,
    getGameDirectoryStatus,
    
    // UI helpers
    getSettingsCategories,
  }
}