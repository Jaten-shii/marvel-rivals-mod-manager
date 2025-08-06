import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { 
  ModInfo, 
  ModCategory, 
  Character, 
  CategoryStats, 
  CharacterStats,
  ModInstallProgress,
  ModOrganizationProgress 
} from 'shared/types'
import { useSettingsContext } from './SettingsContext'

interface ModContextState {
  // Mod Data
  mods: ModInfo[]
  filteredMods: ModInfo[]
  selectedMod: ModInfo | null
  
  // Filters
  selectedCategory: ModCategory | 'All'
  selectedCharacter: Character | 'All'
  searchQuery: string
  
  // Statistics
  categoryStats: CategoryStats[]
  characterStats: CharacterStats[]
  
  // Loading States
  isLoading: boolean
  isRefreshing: boolean
  installProgress: ModInstallProgress | null
  organizationProgress: ModOrganizationProgress | null
  
  // Error State
  error: string | null
}

interface ModContextActions {
  // Mod Management
  refreshMods: () => Promise<void>
  installMod: (filePath: string) => Promise<void>
  enableMod: (modId: string, enabled: boolean) => Promise<void>
  deleteMod: (modId: string) => Promise<void>
  updateModMetadata: (modId: string, metadata: Partial<ModInfo['metadata']>) => Promise<void>
  
  // Selection
  selectMod: (mod: ModInfo | null) => void
  
  // Filtering
  setSelectedCategory: (category: ModCategory | 'All') => void
  setSelectedCharacter: (character: Character | 'All') => void
  setSearchQuery: (query: string) => void
  
  // Utilities
  clearError: () => void
}

type ModContextValue = ModContextState & ModContextActions

const ModContext = createContext<ModContextValue | null>(null)

export function useModContext() {
  const context = useContext(ModContext)
  if (!context) {
    throw new Error('useModContext must be used within a ModProvider')
  }
  return context
}

interface ModProviderProps {
  children: React.ReactNode
}

export function ModProvider({ children }: ModProviderProps) {
  // Contexts
  const settingsContext = useSettingsContext()
  
  // State
  const [mods, setMods] = useState<ModInfo[]>([])
  const [filteredMods, setFilteredMods] = useState<ModInfo[]>([])
  const [selectedMod, setSelectedMod] = useState<ModInfo | null>(null)
  
  const [selectedCategory, setSelectedCategory] = useState<ModCategory | 'All'>('All')
  const [selectedCharacter, setSelectedCharacter] = useState<Character | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')
  
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([])
  const [characterStats, setCharacterStats] = useState<CharacterStats[]>([])
  
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [installProgress, setInstallProgress] = useState<ModInstallProgress | null>(null)
  const [organizationProgress, setOrganizationProgress] = useState<ModOrganizationProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Track initialization state
  const hasInitializedRef = useRef(false)

  // Calculate statistics
  const calculateStats = useCallback((modList: ModInfo[]) => {
    const categoryMap = new Map<ModCategory, { count: number; enabled: number; disabled: number }>()
    const characterMap = new Map<Character, { count: number; enabled: number; disabled: number }>()

    modList.forEach(mod => {
      // Category stats
      const categoryData = categoryMap.get(mod.category) || { count: 0, enabled: 0, disabled: 0 }
      categoryData.count++
      if (mod.enabled) categoryData.enabled++
      else categoryData.disabled++
      categoryMap.set(mod.category, categoryData)

      // Character stats
      if (mod.character) {
        const characterData = characterMap.get(mod.character) || { count: 0, enabled: 0, disabled: 0 }
        characterData.count++
        if (mod.enabled) characterData.enabled++
        else characterData.disabled++
        characterMap.set(mod.character, characterData)
      }
    })

    const newCategoryStats: CategoryStats[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      ...data
    }))

    const newCharacterStats: CharacterStats[] = Array.from(characterMap.entries()).map(([character, data]) => ({
      character,
      ...data
    }))

    setCategoryStats(newCategoryStats)
    setCharacterStats(newCharacterStats)
  }, [])

  // Filter mods based on current filters
  const filterMods = useCallback(() => {
    let filtered = [...mods]

    // Category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(mod => mod.category === selectedCategory)
    }

    // Character filter
    if (selectedCharacter !== 'All') {
      filtered = filtered.filter(mod => mod.character === selectedCharacter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(mod =>
        mod.name.toLowerCase().includes(query) ||
        mod.metadata.description?.toLowerCase().includes(query) ||
        mod.metadata.author?.toLowerCase().includes(query) ||
        mod.metadata.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    setFilteredMods(filtered)
  }, [mods, selectedCategory, selectedCharacter, searchQuery])


  // Update filtered mods when filters change
  useEffect(() => {
    filterMods()
  }, [filterMods])

  // Update statistics when mods change
  useEffect(() => {
    calculateStats(mods)
  }, [mods, calculateStats])

  // Actions
  const refreshMods = useCallback(async (organizeFirst: boolean = true) => {
    try {
      setIsRefreshing(true)
      setError(null)
      
      // Use organization-enabled refresh for better file management
      const modList = await window.electronAPI.mod.getAllWithOrganization(organizeFirst)
      setMods(modList)
      
      // Update selected mod if it still exists
      if (selectedMod) {
        const updatedMod = modList.find(mod => mod.id === selectedMod.id)
        setSelectedMod(updatedMod || null)
      }

      // Check if no game directory is configured to provide better user guidance
      if (modList.length === 0 && !settingsContext.settings.gameDirectory) {
        console.log('No game directory configured - first-time setup needed')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh mods'
      setError(errorMessage)
      console.error('Error refreshing mods:', err)
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }, [selectedMod, settingsContext.settings.gameDirectory])

  // Load mods only when settings are ready and game directory is configured
  useEffect(() => {
    // Only load mods if:
    // 1. Settings are not loading (initialization complete)
    // 2. Game directory is configured
    // 3. We haven't already initialized
    if (!settingsContext.isLoading && 
        settingsContext.settings.gameDirectory && 
        !hasInitializedRef.current) {
      hasInitializedRef.current = true
      refreshMods()
    }
  }, [
    settingsContext.isLoading, 
    settingsContext.settings.gameDirectory, 
    refreshMods
  ])

  // Set up organization progress listener
  useEffect(() => {
    const unsubscribe = window.electronAPI.events.onOrganizationProgress((progress) => {
      setOrganizationProgress(progress)
      
      // Clear progress when complete or error
      if (progress.status === 'complete' || progress.status === 'error') {
        setTimeout(() => {
          setOrganizationProgress(null)
        }, 3000) // Clear after 3 seconds
      }
    })

    return unsubscribe
  }, [])

  const installMod = useCallback(async (filePath: string) => {
    try {
      setError(null)
      
      // Listen for progress updates
      const unsubscribe = window.electronAPI.events.onInstallProgress((progress) => {
        setInstallProgress(progress)
      })

      const newMod = await window.electronAPI.mod.install(filePath)
      setMods(prevMods => [...prevMods, newMod])
      
      unsubscribe()
      setInstallProgress(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to install mod'
      setError(errorMessage)
      console.error('Error installing mod:', err)
      setInstallProgress(null)
    }
  }, [])

  const enableMod = useCallback(async (modId: string, enabled: boolean) => {
    try {
      setError(null)
      
      await window.electronAPI.mod.enable(modId, enabled)
      
      setMods(prevMods => 
        prevMods.map(mod => 
          mod.id === modId ? { ...mod, enabled } : mod
        )
      )
      
      // Update selected mod if it's the one being toggled
      if (selectedMod?.id === modId) {
        setSelectedMod(prev => prev ? { ...prev, enabled } : null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle mod'
      setError(errorMessage)
      console.error('Error toggling mod:', err)
    }
  }, [selectedMod])

  const deleteMod = useCallback(async (modId: string) => {
    console.log(`[ModContext] deleteMod called for modId: ${modId}`)
    console.log(`[ModContext] electronAPI available:`, !!window.electronAPI)
    console.log(`[ModContext] electronAPI.mod available:`, !!window.electronAPI?.mod)
    console.log(`[ModContext] electronAPI.mod.delete available:`, !!window.electronAPI?.mod?.delete)
    
    try {
      setError(null)
      
      console.log(`[ModContext] About to call window.electronAPI.mod.delete(${modId})`)
      await window.electronAPI.mod.delete(modId)
      console.log(`[ModContext] Successfully called electronAPI.mod.delete`)
      
      setMods(prevMods => {
        const filteredMods = prevMods.filter(mod => mod.id !== modId)
        console.log(`[ModContext] Removed mod from state. Before: ${prevMods.length}, After: ${filteredMods.length}`)
        return filteredMods
      })
      
      // Clear selection if deleted mod was selected
      if (selectedMod?.id === modId) {
        console.log(`[ModContext] Clearing selected mod as it was deleted`)
        setSelectedMod(null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete mod'
      console.error(`[ModContext] Error in deleteMod:`, err)
      console.error(`[ModContext] Error message:`, errorMessage)
      
      setError(errorMessage)
      throw err
    }
  }, [selectedMod])

  const updateModMetadata = useCallback(async (modId: string, metadata: Partial<ModInfo['metadata']>) => {
    try {
      setError(null)
      
      const updatedMod = await window.electronAPI.mod.updateMetadata(modId, metadata)
      
      setMods(prevMods => 
        prevMods.map(mod => 
          mod.id === modId ? updatedMod : mod
        )
      )
      
      // Update selected mod if it's the one being updated
      if (selectedMod?.id === modId) {
        setSelectedMod(updatedMod)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update mod metadata'
      setError(errorMessage)
      console.error('Error updating mod metadata:', err)
    }
  }, [selectedMod])

  const selectMod = useCallback((mod: ModInfo | null) => {
    setSelectedMod(mod)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const contextValue: ModContextValue = {
    // State
    mods,
    filteredMods,
    selectedMod,
    selectedCategory,
    selectedCharacter,
    searchQuery,
    categoryStats,
    characterStats,
    isLoading,
    isRefreshing,
    installProgress,
    organizationProgress,
    error,
    
    // Actions
    refreshMods,
    installMod,
    enableMod,
    deleteMod,
    updateModMetadata,
    selectMod,
    setSelectedCategory,
    setSelectedCharacter,
    setSearchQuery,
    clearError,
  }

  return (
    <ModContext.Provider value={contextValue}>
      {children}
    </ModContext.Provider>
  )
}