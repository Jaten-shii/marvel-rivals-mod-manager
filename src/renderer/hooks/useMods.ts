import { useCallback } from 'react'
import { useModContext } from '../contexts/ModContext'
import { useUIContext } from '../contexts/UIContext'
import type { ModInfo, ModCategory, Character } from 'shared/types'

/**
 * Custom hook for mod management operations
 * Provides high-level mod operations with UI integration
 */
export function useMods() {
  const modContext = useModContext()
  const uiContext = useUIContext()

  // Enhanced mod operations with UI feedback
  const installModWithFeedback = useCallback(async (filePath: string) => {
    try {
      uiContext.setInstalling(true)
      uiContext.showNotification({
        type: 'info',
        title: 'Installing mod...',
        message: 'Please wait while the mod is being installed.',
        duration: 0, // Don't auto-dismiss
      })
      
      await modContext.installMod(filePath)
      
      uiContext.clearAllNotifications()
      uiContext.showNotification({
        type: 'success',
        title: 'Mod installed successfully',
        message: 'The mod has been installed and is ready to use.',
      })
    } catch (error) {
      uiContext.clearAllNotifications()
      uiContext.showNotification({
        type: 'error',
        title: 'Installation failed',
        message: error instanceof Error ? error.message : 'Failed to install mod',
      })
    } finally {
      uiContext.setInstalling(false)
    }
  }, [modContext, uiContext])

  const enableModWithFeedback = useCallback(async (modId: string, enabled: boolean) => {
    try {
      await modContext.enableMod(modId, enabled)
      
      const mod = modContext.mods.find(m => m.id === modId)
      if (mod) {
        uiContext.showNotification({
          type: 'success',
          title: enabled ? 'Mod enabled' : 'Mod disabled',
          message: `${mod.name} has been ${enabled ? 'enabled' : 'disabled'}.`,
          duration: 3000,
        })
      }
    } catch (error) {
      uiContext.showNotification({
        type: 'error',
        title: enabled ? 'Failed to enable mod' : 'Failed to disable mod',
        message: error instanceof Error ? error.message : 'An error occurred',
      })
    }
  }, [modContext, uiContext])

  const deleteModWithConfirmation = useCallback(async (mod: ModInfo) => {
    console.log(`[useMods] deleteModWithConfirmation called for mod: ${mod.name} (ID: ${mod.id})`)
    console.log(`[useMods] modContext available:`, !!modContext)
    console.log(`[useMods] uiContext available:`, !!uiContext)
    
    // TEMPORARY FIX: Skip dialog since dialog system is not implemented
    // Delete directly for now until dialog component is created
    console.log(`[useMods] TEMP: Skipping dialog, deleting directly for testing`)
    
    try {
      console.log(`[useMods] About to call modContext.deleteMod directly`)
      await modContext.deleteMod(mod.id)
      
      console.log(`[useMods] Successfully deleted mod: ${mod.name}`)
      
      uiContext.showNotification({
        type: 'success',
        title: 'Mod deleted',
        message: `${mod.name} has been deleted.`,
      })
      
      // Hide details panel if the deleted mod was selected
      if (modContext.selectedMod?.id === mod.id) {
        uiContext.hideDetailsPanel()
      }
    } catch (error) {
      console.error(`[useMods] Error deleting mod ${mod.name}:`, error)
      
      uiContext.showNotification({
        type: 'error',
        title: 'Failed to delete mod',
        message: error instanceof Error ? error.message : 'An error occurred',
      })
    }
  }, [modContext, uiContext])

  const selectModAndShowDetails = useCallback((mod: ModInfo | null) => {
    modContext.selectMod(mod)
    if (mod) {
      uiContext.showDetailsPanel()
    } else {
      uiContext.hideDetailsPanel()
    }
  }, [modContext, uiContext])

  const openModFolder = useCallback(async (filePath: string) => {
    try {
      console.log(`[useMods] Opening folder for path: ${filePath}`)
      await window.electronAPI.system.openFolder(filePath)
    } catch (error) {
      console.error('[useMods] Error opening folder:', error)
      uiContext.showNotification({
        type: 'error',
        title: 'Failed to open folder',
        message: error instanceof Error ? error.message : 'Could not open file location',
      })
    }
  }, [uiContext])

  const refreshModsWithFeedback = useCallback(async () => {
    try {
      // Clear any existing notifications
      uiContext.clearAllNotifications()
      
      // Show loading notification
      uiContext.showNotification({
        type: 'info',
        title: 'Refreshing mods',
        message: 'Scanning and organizing mod files...',
        duration: 0, // Don't auto-dismiss
      })
      
      // Call refresh through ModContext to ensure state is updated
      await modContext.refreshMods()
      
      // Clear loading notifications
      uiContext.clearAllNotifications()
      
      // Show completion notification
      const modCount = modContext.mods.length
      const message = modCount > 0 
        ? `${modCount} mods found and synchronized`
        : 'No mods found in the mod directory'
      
      uiContext.showNotification({
        type: 'success',
        title: 'Refresh Complete',
        message,
        duration: 3000,
      })
    } catch (error) {
      uiContext.clearAllNotifications()
      uiContext.showNotification({
        type: 'error',
        title: 'Refresh Failed',
        message: error instanceof Error ? error.message : 'An error occurred while refreshing mods',
        duration: 5000,
      })
    }
  }, [modContext, uiContext])


  // Filtering helpers
  const getFilteredModsByCategory = useCallback((category: ModCategory | 'All') => {
    if (category === 'All') return modContext.mods
    return modContext.mods.filter(mod => mod.category === category)
  }, [modContext.mods])

  const getFilteredModsByCharacter = useCallback((character: Character | 'All') => {
    if (character === 'All') return modContext.mods
    return modContext.mods.filter(mod => mod.character === character)
  }, [modContext.mods])

  const searchMods = useCallback((query: string) => {
    if (!query.trim()) return modContext.mods
    
    const searchTerm = query.toLowerCase().trim()
    return modContext.mods.filter(mod =>
      mod.name.toLowerCase().includes(searchTerm) ||
      mod.metadata.description?.toLowerCase().includes(searchTerm) ||
      mod.metadata.author?.toLowerCase().includes(searchTerm) ||
      mod.metadata.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
    )
  }, [modContext.mods])

  // Statistics helpers
  const getModStatistics = useCallback(() => {
    const total = modContext.mods.length
    const enabled = modContext.mods.filter(mod => mod.enabled).length
    const disabled = total - enabled
    
    return {
      total,
      enabled,
      disabled,
      enabledPercentage: total > 0 ? Math.round((enabled / total) * 100) : 0,
    }
  }, [modContext.mods])

  return {
    // State
    mods: modContext.mods,
    filteredMods: modContext.filteredMods,
    selectedMod: modContext.selectedMod,
    categoryStats: modContext.categoryStats,
    characterStats: modContext.characterStats,
    isLoading: modContext.isLoading,
    isRefreshing: modContext.isRefreshing,
    installProgress: modContext.installProgress,
    organizationProgress: modContext.organizationProgress,
    error: modContext.error,
    
    // Filters
    selectedCategory: modContext.selectedCategory,
    selectedCharacter: modContext.selectedCharacter,
    searchQuery: modContext.searchQuery,
    
    // Basic operations
    refreshMods: modContext.refreshMods,
    installMod: modContext.installMod,
    enableMod: modContext.enableMod,
    deleteMod: modContext.deleteMod,
    updateModMetadata: modContext.updateModMetadata,
    selectMod: modContext.selectMod,
    setSelectedCategory: modContext.setSelectedCategory,
    setSelectedCharacter: modContext.setSelectedCharacter,
    setSearchQuery: modContext.setSearchQuery,
    clearError: modContext.clearError,
    
    // Enhanced operations with UI feedback
    installModWithFeedback,
    enableModWithFeedback,
    deleteModWithConfirmation,
    selectModAndShowDetails,
    openModFolder,
    refreshModsWithFeedback,
    
    // Filtering helpers
    getFilteredModsByCategory,
    getFilteredModsByCharacter,
    searchMods,
    
    // Statistics
    getModStatistics,
  }
}