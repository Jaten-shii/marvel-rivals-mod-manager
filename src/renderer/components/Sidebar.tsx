import { ChevronDown, ChevronRight, Gamepad2, Eye, Volume2, Layers, FolderOpen, ExternalLink, RefreshCw, CheckCircle, XCircle, Trash2, Tag, Download } from 'lucide-react'
import { useState, useEffect } from 'react'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { cn } from 'renderer/lib/utils'
import { ChangelogModal } from './ChangelogModal'
import { UpdateModal } from './UpdateModal'

import type { ModCategory, Character, CategoryStats, CharacterStats } from 'shared/types'
import type { UpdateInfo } from '../../preload'
import { CATEGORIES, CHARACTERS } from 'shared/constants'

interface SidebarProps {
  selectedCategory: ModCategory | 'All'
  selectedCharacter: Character | 'All'
  categoryStats: CategoryStats[]
  characterStats: CharacterStats[]
  onCategorySelect: (category: ModCategory | 'All') => void
  onCharacterSelect: (character: Character | 'All') => void
  onRefresh: () => void
  isRefreshing?: boolean
  onEnableAll: () => void
  onDisableAll: () => void
  onDeleteAll: () => void
  totalModCount: number
  className?: string
}

export function Sidebar({
  selectedCategory,
  selectedCharacter,
  categoryStats,
  characterStats,
  onCategorySelect,
  onCharacterSelect,
  onRefresh,
  isRefreshing = false,
  onEnableAll,
  onDisableAll,
  onDeleteAll,
  totalModCount,
  className,
}: SidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<ModCategory>>(new Set())
  const [gameDirectory, setGameDirectory] = useState<string>('')
  const [appVersion, setAppVersion] = useState<string>('')
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Fetch game directory and app version on component mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [settings, version] = await Promise.all([
          window.electronAPI.system.getSettings(),
          window.electronAPI.changelog.getAppVersion()
        ])
        
        if (settings.gameDirectory) {
          setGameDirectory(settings.gameDirectory)
        }
        
        setAppVersion(version)
      } catch (error) {
        console.error('Error fetching initial data:', error)
      }
    }
    
    fetchInitialData()
  }, [])

  const toggleCategory = (category: ModCategory) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const getCategoryCount = (category: ModCategory) => {
    return categoryStats.find(stat => stat.category === category)?.count || 0
  }

  const getCharacterCount = (character: Character) => {
    return characterStats.find(stat => stat.character === character)?.count || 0
  }

  const getTotalModCount = () => {
    return categoryStats.reduce((total, stat) => total + stat.count, 0)
  }

  const getCategoryIcon = (category: ModCategory | 'All') => {
    switch (category) {
      case 'Gameplay':
        return <Gamepad2 className="w-4 h-4" />
      case 'UI':
        return <Eye className="w-4 h-4" />
      case 'Audio':
        return <Volume2 className="w-4 h-4" />
      case 'Skins':
        return <Layers className="w-4 h-4" />
      default:
        return <Layers className="w-4 h-4" />
    }
  }

  const getCategoryVariant = (category: ModCategory): 'ui' | 'audio' | 'skins' | 'gameplay' => {
    return category.toLowerCase() as any
  }

  const getModsPath = () => {
    if (!gameDirectory) return ''
    return `${gameDirectory}\\MarvelGame\\Marvel\\Content\\Paks\\~mods`
  }

  const handleCheckForUpdates = async () => {
    try {
      setIsCheckingUpdates(true)
      setUpdateError(null) // Clear previous errors
      setUpdateInfo(null)  // Clear previous results
      
      const result = await window.electronAPI.system.checkForUpdates()
      setUpdateInfo(result)
      setIsUpdateModalOpen(true)
    } catch (error) {
      console.error('Error checking for updates:', error)
      
      // Extract user-friendly error message
      let errorMessage = 'Failed to check for updates. Please try again later.'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      setUpdateError(errorMessage)
      setUpdateInfo(null)
      setIsUpdateModalOpen(true)
    } finally {
      setIsCheckingUpdates(false)
    }
  }

  return (
    <div 
      className={cn('w-64 h-full flex flex-col bg-sidebar border-r border-sidebar-border', className)}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-sidebar-foreground">Categories</h2>
      </div>
      
      {/* Categories List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* All Mods */}
        <Button
          variant={selectedCategory === 'All' ? 'default' : 'ghost'}
          className={cn(
            'w-full justify-between h-10 px-3 transition-all duration-200 hover:scale-105',
            selectedCategory === 'All' 
              ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90' 
              : 'text-white hover:text-white hover:bg-accent/50'
          )}
          onClick={() => onCategorySelect('All')}
        >
          <span className="flex items-center gap-3">
            <Layers className="w-4 h-4" />
            All
          </span>
          <Badge variant="outline" className={cn(
            "ml-2 text-xs border-sidebar-border",
            selectedCategory === 'All' ? "text-black" : ""
          )}>
            {getTotalModCount()}
          </Badge>
        </Button>

        {/* Individual Categories */}
        {Object.entries(CATEGORIES).map(([categoryKey, categoryConfig]) => {
          const category = categoryKey as ModCategory
          const isSelected = selectedCategory === category
          const count = getCategoryCount(category)

          return (
            <Button
              key={category}
              variant={isSelected ? 'default' : 'ghost'}
              className={cn(
                'w-full justify-between h-10 px-3 transition-all duration-200 hover:scale-105',
                isSelected 
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90' 
                  : 'text-white hover:text-white hover:bg-accent/50'
              )}
              onClick={() => onCategorySelect(category)}
            >
              <span className="flex items-center gap-3">
                {getCategoryIcon(category)}
                {categoryConfig.name}
              </span>
              <Badge variant="outline" className={cn(
                "ml-2 text-xs border-sidebar-border",
                isSelected ? "text-black" : ""
              )}>
                {count}
              </Badge>
            </Button>
          )
        })}
      </div>

      {/* Version Section */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <h3 className="text-sm font-medium text-sidebar-foreground mb-3">Version</h3>
        
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-center gap-2 text-xs border-sidebar-border text-white hover:text-white hover:bg-accent/50 transition-all duration-200 hover:scale-105"
          onClick={() => setIsChangelogOpen(true)}
        >
          <Tag className="w-3 h-3" />
          {appVersion ? `v${appVersion}` : 'Loading...'}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full justify-center gap-2 text-xs border-sidebar-border text-white hover:text-white hover:bg-blue-500/20 hover:border-blue-500/30 transition-all duration-200 hover:scale-105",
            isCheckingUpdates && 'animate-pulse'
          )}
          onClick={handleCheckForUpdates}
          disabled={isCheckingUpdates}
        >
          <Download className={cn('w-3 h-3', isCheckingUpdates && 'animate-pulse')} />
          {isCheckingUpdates ? 'Checking...' : 'Check for Updates'}
        </Button>
      </div>

      {/* Tools Section */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <h3 className="text-sm font-medium text-sidebar-foreground mb-3">Tools</h3>
        
        <div className="space-y-2">
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full justify-center gap-2 text-xs border-sidebar-border text-white hover:text-white hover:bg-accent/50 transition-all duration-200 hover:scale-105",
              isRefreshing && 'animate-pulse'
            )}
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('w-3 h-3', isRefreshing && 'animate-spin')} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Mods'}
          </Button>

          {/* Enable All Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-2 text-xs border-sidebar-border text-white hover:text-white hover:bg-green-500/20 hover:border-green-500/30 transition-all duration-200 hover:scale-105"
            onClick={onEnableAll}
            disabled={totalModCount === 0}
          >
            <CheckCircle className="w-3 h-3" />
            Enable All
          </Button>

          {/* Disable All Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-2 text-xs border-sidebar-border text-white hover:text-white hover:bg-yellow-500/20 hover:border-yellow-500/30 transition-all duration-200 hover:scale-105"
            onClick={onDisableAll}
            disabled={totalModCount === 0}
          >
            <XCircle className="w-3 h-3" />
            Disable All
          </Button>

          {/* Delete All Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-2 text-xs border-sidebar-border text-white hover:text-white hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200 hover:scale-105"
            onClick={onDeleteAll}
            disabled={totalModCount === 0}
          >
            <Trash2 className="w-3 h-3" />
            Delete All
          </Button>
        </div>
      </div>

      {/* Mod Directory Section */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <h3 className="text-sm font-medium text-sidebar-foreground mb-3">Mod Directory</h3>
        
        {/* Directory Path Display */}
        {gameDirectory && (
          <div className="mb-3 p-2 bg-sidebar-accent/20 rounded border border-sidebar-border">
            <p className="text-xs text-sidebar-foreground break-all">
              {getModsPath()}
            </p>
          </div>
        )}
        
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-2 text-xs border-sidebar-border text-white hover:text-white hover:bg-accent/50 transition-all duration-200 hover:scale-105"
            onClick={async () => {
              try {
                const path = await window.electronAPI.system.selectGameDir()
                if (path) {
                  // Update local state with new directory
                  setGameDirectory(path)
                  console.log('Selected directory:', path)
                }
              } catch (error) {
                console.error('Error selecting directory:', error)
              }
            }}
          >
            <FolderOpen className="w-3 h-3" />
            Browse
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-center gap-2 text-xs border-sidebar-border text-white hover:text-white hover:bg-accent/50 transition-all duration-200 hover:scale-105"
            onClick={async () => {
              try {
                // Open the current mods folder
                const settings = await window.electronAPI.system.getSettings()
                if (settings.gameDirectory) {
                  const modsPath = `${settings.gameDirectory}\\MarvelGame\\Marvel\\Content\\Paks\\~mods`
                  await window.electronAPI.system.openFolder(modsPath)
                }
              } catch (error) {
                console.error('Error opening folder:', error)
              }
            }}
          >
            <ExternalLink className="w-3 h-3" />
            Open Folder
          </Button>
        </div>
      </div>

      {/* Changelog Modal */}
      <ChangelogModal 
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />
      
      {/* Update Modal */}
      <UpdateModal 
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false)
          setUpdateError(null)
          setUpdateInfo(null)
        }}
        updateInfo={updateInfo}
        isError={!!updateError}
        errorMessage={updateError || undefined}
        onRetry={updateError ? handleCheckForUpdates : undefined}
      />
    </div>
  )
}