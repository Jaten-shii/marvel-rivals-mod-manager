import { Download, Trash2, Edit, FolderOpen, Gamepad2, Eye, Volume2, Layers } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { cn } from 'renderer/lib/utils'
import { useContextMenu } from 'renderer/contexts/ContextMenuContext'

import type { ModInfo, ViewMode } from 'shared/types'
import { CATEGORIES, CHARACTERS } from 'shared/constants'

interface ModCardProps {
  mod: ModInfo
  viewMode: ViewMode
  isSelected?: boolean
  onSelect?: (mod: ModInfo) => void
  onToggleEnabled?: (modId: string, enabled: boolean) => void
  onEditMetadata?: (mod: ModInfo) => void
  onDelete?: (mod: ModInfo) => void
  onOpenFolder?: (path: string) => void
  className?: string
}

export function ModCard({
  mod,
  viewMode,
  isSelected = false,
  onSelect,
  onToggleEnabled,
  onEditMetadata,
  onDelete,
  onOpenFolder,
  className,
}: ModCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [characterIconUrl, setCharacterIconUrl] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)
  const [thumbnailError, setThumbnailError] = useState(false)
  const { showContextMenu } = useContextMenu()

  const categoryConfig = CATEGORIES[mod.category]
  
  // Only show character info when properly configured in metadata
  const hasValidCharacter = Boolean(
    mod.character && 
    mod.metadata.character && 
    mod.character === mod.metadata.character &&
    mod.character in CHARACTERS
  )
    
  const characterConfig = hasValidCharacter && mod.character ? CHARACTERS[mod.character] : null

  const handleToggleEnabled = () => {
    if (!onToggleEnabled) return
    
    setIsLoading(true)
    try {
      onToggleEnabled(mod.id, !mod.enabled)
    } catch (error) {
      console.error('Error toggling mod:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const contextMenuItems = [
      {
        id: 'edit',
        label: 'Edit Metadata',
        icon: <Edit className="w-4 h-4" />,
        onClick: () => onEditMetadata?.(mod)
      },
      {
        id: 'folder',
        label: 'Show in Folder',
        icon: <FolderOpen className="w-4 h-4" />,
        onClick: () => {
          // Extract directory path from file path
          const directoryPath = mod.filePath.replace(/[^\\\\/]*$/, '')
          onOpenFolder?.(directoryPath.endsWith('\\') || directoryPath.endsWith('/') 
            ? directoryPath.slice(0, -1) 
            : directoryPath)
        }
      },
      {
        id: 'delete',
        label: 'Delete Mod',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => {
          console.log(`[ModCard] Delete button clicked for mod: ${mod.name} (ID: ${mod.id})`)
          console.log(`[ModCard] onDelete function available:`, !!onDelete)
          console.log(`[ModCard] Mod object:`, mod)
          onDelete?.(mod)
        },
        variant: 'destructive' as const
      }
    ]
    
    showContextMenu(e.clientX, e.clientY, contextMenuItems)
  }


  // Load character icon URL when character changes
  useEffect(() => {
    if (hasValidCharacter && mod.character) {
      const loadCharacterIcon = async () => {
        try {
          const iconUrl = await window.electronAPI.system.getCharacterIconProtocolUrl(mod.character!)
          setCharacterIconUrl(iconUrl)
        } catch (error) {
          console.error('Error loading character icon:', error)
          setCharacterIconUrl(null)
        }
      }
      loadCharacterIcon()
    } else {
      setCharacterIconUrl(null)
    }
  }, [hasValidCharacter, mod.character])

  // Load thumbnail URL when mod changes
  useEffect(() => {
    if (mod.thumbnailPath) {
      const loadThumbnailUrl = async () => {
        try {
          // Extract just the filename from the full path
          const fileName = mod.thumbnailPath.split(/[\\/]/).pop() || ''
          const url = await window.electronAPI.system.getThumbnailUrl(fileName)
          setThumbnailUrl(url)
        } catch (error) {
          console.error('Error loading thumbnail URL:', error)
          setThumbnailUrl(null)
        }
      }
      loadThumbnailUrl()
    } else {
      setThumbnailUrl(null)
    }
  }, [mod.thumbnailPath])

  // Reset thumbnail states when mod changes
  useEffect(() => {
    setThumbnailLoading(false)
    setThumbnailError(false)
  }, [mod.id])


  const getCategoryIcon = () => {
    switch (mod.category) {
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

  const getCategoryColor = () => {
    switch (mod.category) {
      case 'Gameplay':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      case 'UI':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      case 'Audio':
        return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'Skins':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const formatDate = (date: Date): string => {
    const dateObj = new Date(date)
    const dateStr = dateObj.toLocaleDateString()
    const timeStr = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    return `${dateStr}, ${timeStr}`
  }


  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        whileHover={{ scale: 1.005 }}
        transition={{ duration: 0.2 }}
      >
        <Card
          data-mod-card
          className={cn(
            'cursor-pointer transition-all duration-200 hover:shadow-xl bg-card border-border',
            'dark:bg-card dark:border-border',
            isSelected && 'ring-2 ring-primary',
            !mod.enabled && 'opacity-60',
            className
          )}
          onClick={() => onSelect?.(mod)}
          onContextMenu={handleContextMenu}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Thumbnail */}
              <div className="relative flex-shrink-0">
                <div className="w-44 h-24 rounded-lg bg-muted overflow-hidden border border-border">
                  {thumbnailUrl && !thumbnailError ? (
                    <>
                      {thumbnailLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      <img
                        src={thumbnailUrl}
                        alt={mod.name}
                        className="w-full h-full object-cover"
                        onLoad={() => setThumbnailLoading(false)}
                        onLoadStart={() => setThumbnailLoading(true)}
                        onError={() => {
                          setThumbnailLoading(false)
                          setThumbnailError(true)
                        }}
                      />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-card">
                      {getCategoryIcon()}
                    </div>
                  )}
                </div>
                
                {/* Status Indicator */}
                <div className="absolute -top-1 -right-1">
                  <div
                    className={cn(
                      'w-3 h-3 rounded-full border-2 border-background',
                      mod.enabled 
                        ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]' 
                        : 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                    )}
                  />
                </div>
              </div>

              {/* Mod Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base truncate text-white mb-1">{mod.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2 min-h-[2rem]">
                      {mod.metadata.description || 'No description'}
                    </p>
                    
                    {/* Character Info */}
                    {characterConfig && characterIconUrl && (
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-muted border border-border flex-shrink-0">
                          <img
                            src={characterIconUrl}
                            alt={characterConfig.displayName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Hide the image if it fails to load
                              const img = e.target as HTMLImageElement
                              img.style.display = 'none'
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-white">
                          {characterConfig.displayName}
                        </span>
                      </div>
                    )}
                    
                    {/* Category Badge */}
                    <div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          'text-xs font-medium border',
                          getCategoryColor()
                        )}
                      >
                        <span className="flex items-center gap-1">
                          {getCategoryIcon()}
                          {categoryConfig.name}
                        </span>
                      </Badge>
                    </div>
                  </div>

                  {/* Actions and Info */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* File Info */}
                    <div className="text-xs text-muted-foreground text-right">
                      <div className="font-medium">{formatFileSize(mod.fileSize)}</div>
                      <div>{formatDate(mod.installDate)}</div>
                    </div>

                    {/* Enable/Disable Button */}
                    <Button
                      size="sm"
                      variant={mod.enabled ? "secondary" : "outline"}
                      className={cn(
                        'text-xs h-7 px-3',
                        mod.enabled 
                          ? 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30' 
                          : 'bg-muted/50 text-muted-foreground border-muted hover:bg-muted hover:text-foreground'
                      )}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleEnabled()
                      }}
                      disabled={isLoading}
                    >
                      {isLoading ? '...' : mod.enabled ? 'Enabled' : 'Disabled'}
                    </Button>

                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Grid view - Professional gaming design
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="w-80 flex-shrink-0"
      style={{ isolation: 'isolate' }}
    >
      <Card
        data-mod-card
        className={cn(
          'cursor-pointer transition-all duration-200 hover:shadow-xl bg-card border-border',
          'dark:bg-card dark:border-border',
          isSelected && 'ring-2 ring-primary',
          !mod.enabled && 'opacity-60',
          className
        )}
        onClick={() => onSelect?.(mod)}
        onContextMenu={handleContextMenu}
      >
        {/* Thumbnail Section */}
        <div className="relative w-full aspect-video rounded-t-lg bg-muted overflow-hidden">
          {thumbnailUrl && !thumbnailError ? (
            <>
              {thumbnailLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <img
                src={thumbnailUrl}
                alt={mod.name}
                className="w-full h-full object-cover"
                onLoad={() => setThumbnailLoading(false)}
                onLoadStart={() => setThumbnailLoading(true)}
                onError={() => {
                  setThumbnailLoading(false)
                  setThumbnailError(true)
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-card">
              {getCategoryIcon()}
            </div>
          )}
          
          {/* Status Indicator */}
          <div className="absolute top-3 right-3">
            <div
              className={cn(
                'w-2 h-2 rounded-full',
                mod.enabled 
                  ? 'bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]' 
                  : 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
              )}
            />
          </div>

        </div>

        {/* Content Section */}
        <CardContent className="p-4 flex flex-col h-[200px]">
          {/* Title and Description */}
          <div className="mb-3">
            <h3 className="font-semibold text-base truncate mb-1 text-white">{mod.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
              {mod.metadata.description || 'No description'}
            </p>
          </div>

          {/* Character Info - Fixed Height Container */}
          <div className="mb-2 h-9 flex items-center">
            {characterConfig && characterIconUrl && (
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-muted border border-border flex-shrink-0">
                  <img
                    src={characterIconUrl}
                    alt={characterConfig.displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide the image if it fails to load
                      const img = e.target as HTMLImageElement
                      img.style.display = 'none'
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-white truncate">
                  {characterConfig.displayName}
                </span>
              </div>
            )}
          </div>

          {/* Category Badge */}
          <div className="mb-2">
            <Badge 
              variant="outline" 
              className={cn(
                'text-xs font-medium border',
                getCategoryColor()
              )}
            >
              <span className="flex items-center gap-1">
                {getCategoryIcon()}
                {categoryConfig.name}
              </span>
            </Badge>
          </div>

          {/* Bottom Row: File Size, Date, Enable Button */}
          <div className="flex items-center justify-between mt-auto">
            <div className="text-xs text-muted-foreground">
              <div>{formatFileSize(mod.fileSize)}</div>
              <div>{formatDate(mod.installDate)}</div>
            </div>
            
            <Button
              size="sm"
              variant={mod.enabled ? "secondary" : "outline"}
              className={cn(
                'text-xs h-7 px-3',
                mod.enabled 
                  ? 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30' 
                  : 'bg-muted/50 text-muted-foreground border-muted hover:bg-muted hover:text-foreground'
              )}
              onClick={(e) => {
                e.stopPropagation()
                handleToggleEnabled()
              }}
              disabled={isLoading}
            >
              {isLoading ? '...' : mod.enabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>

      </Card>

    </motion.div>
  )
}