import { X, Edit, Trash2, FolderOpen, Image } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn } from 'renderer/lib/utils'

import type { ModInfo } from 'shared/types'
import { CATEGORIES, CHARACTERS } from 'shared/constants'

interface DetailsPanelProps {
  mod: ModInfo | null
  isVisible: boolean
  onClose: () => void
  onToggleEnabled?: (modId: string, enabled: boolean) => void
  onEditMetadata?: (mod: ModInfo) => void
  onDelete?: (mod: ModInfo) => void
  onOpenFolder?: (path: string) => void
  className?: string
}

export function DetailsPanel({
  mod,
  isVisible,
  onClose,
  onToggleEnabled,
  onEditMetadata,
  onDelete,
  onOpenFolder,
  className,
}: DetailsPanelProps) {
  const [associatedFiles, setAssociatedFiles] = useState<string[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [characterIconUrl, setCharacterIconUrl] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)
  const [thumbnailError, setThumbnailError] = useState(false)

  // Load associated files when mod changes
  useEffect(() => {
    if (mod && isVisible) {
      const loadAssociatedFiles = async () => {
        setIsLoadingFiles(true)
        try {
          const files = await window.electronAPI.mod.getAssociatedFiles(mod.id)
          setAssociatedFiles(files)
        } catch (error) {
          console.error('Error loading associated files:', error)
          // Fallback to mod's associatedFiles property
          setAssociatedFiles(mod.associatedFiles || [mod.filePath])
        } finally {
          setIsLoadingFiles(false)
        }
      }
      
      loadAssociatedFiles()
    }
  }, [mod, isVisible])

  // Load character icon URL when mod changes
  useEffect(() => {
    if (mod && mod.character && isVisible) {
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
  }, [mod, isVisible])

  // Load thumbnail URL when mod changes
  useEffect(() => {
    if (mod && mod.thumbnailPath && isVisible) {
      const loadThumbnailUrl = async () => {
        try {
          // Extract just the filename from the full path
          const fileName = mod.thumbnailPath!.split(/[\\/]/).pop() || ''
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
  }, [mod, isVisible])

  // Reset thumbnail states when mod changes
  useEffect(() => {
    setThumbnailLoading(false)
    setThumbnailError(false)
  }, [mod])

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

  const getFileName = (filePath: string): string => {
    return filePath.split('\\').pop()?.split('/').pop() || filePath
  }

  const handleToggleEnabled = () => {
    if (!mod || !onToggleEnabled) return
    onToggleEnabled(mod.id, !mod.enabled)
  }

  if (!mod) return null

  const categoryConfig = CATEGORIES[mod.category]
  const characterConfig = mod.character ? CHARACTERS[mod.character] : null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={cn(
            'fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg z-50 overflow-y-auto',
            className
          )}
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Mod Details</h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Thumbnail Section */}
            <div className="relative w-full aspect-video rounded-lg bg-muted overflow-hidden mb-6 border border-border">
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
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-card">
                  <Image className="w-8 h-8 mb-2" />
                  <span className="text-xs text-center">
                    {thumbnailError ? 'Failed to load thumbnail' : 'No thumbnail'}
                  </span>
                </div>
              )}
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <span className="text-muted-foreground">Name</span>
                <div className="font-medium text-foreground">{mod.name}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Category</span>
                <div className="font-medium text-foreground">{categoryConfig.name}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Character</span>
                <div className="font-medium text-foreground">
                  {characterConfig?.displayName || 'None'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Date Installed</span>
                <div className="font-medium text-foreground">{formatDate(mod.installDate)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Size</span>
                <div className="font-medium text-foreground">{formatFileSize(mod.fileSize)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Files</span>
                <div className="font-medium text-foreground">{associatedFiles.length}</div>
              </div>
            </div>

            {/* Status */}
            <div className="mb-6">
              <span className="text-muted-foreground text-sm">Status</span>
              <div className="mt-1">
                <Badge 
                  className={cn(
                    'text-xs font-medium',
                    mod.enabled 
                      ? 'bg-green-500 text-white hover:bg-green-600' 
                      : 'bg-red-500 text-white hover:bg-red-600'
                  )}
                >
                  {mod.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              <Button
                size="sm"
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
                onClick={() => onEditMetadata?.(mod)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              
              <Button
                size="sm"
                variant="secondary"
                onClick={handleToggleEnabled}
              >
                <X className="w-4 h-4 mr-1" />
                {mod.enabled ? 'Disable' : 'Enable'}
              </Button>
              
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  console.log(`[DetailsPanel] Delete button clicked for mod: ${mod.name} (ID: ${mod.id})`)
                  console.log(`[DetailsPanel] onDelete function available:`, !!onDelete)
                  console.log(`[DetailsPanel] Mod object:`, mod)
                  onDelete?.(mod)
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
              
              <Button
                size="sm"
                className="bg-blue-500 hover:bg-blue-600 text-white"
                onClick={() => {
                  // Extract directory path from file path using path methods
                  const directoryPath = mod.filePath.replace(/[^\\\/]*$/, '')
                  onOpenFolder?.(directoryPath.endsWith('\\') || directoryPath.endsWith('/') 
                    ? directoryPath.slice(0, -1) 
                    : directoryPath)
                }}
              >
                <FolderOpen className="w-4 h-4 mr-1" />
                Folder
              </Button>
            </div>

            {/* Files Section */}
            <div>
              <h3 className="text-sm font-medium mb-2">Files:</h3>
              {isLoadingFiles ? (
                <div className="text-xs text-muted-foreground">Loading files...</div>
              ) : (
                <div className="space-y-1">
                  {associatedFiles.map((filePath, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full flex-shrink-0" />
                      <span className="text-muted-foreground font-mono break-all">
                        {getFileName(filePath)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}