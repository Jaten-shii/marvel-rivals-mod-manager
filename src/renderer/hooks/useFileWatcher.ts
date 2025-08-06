import { useEffect, useRef, useCallback, useState } from 'react'
import { useModContext } from '../contexts/ModContext'
import { useUIContext } from '../contexts/UIContext'
import { useSettingsContext } from '../contexts/SettingsContext'

interface FileWatcherState {
  isWatching: boolean
  watchedPath: string | null
  lastChangeTime: Date | null
  changeCount: number
}

interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
  timestamp: Date
}

/**
 * Custom hook for file system watching
 * Monitors mod directory for changes and triggers automatic refreshes
 */
export function useFileWatcher() {
  const modContext = useModContext()
  const uiContext = useUIContext()
  const settingsContext = useSettingsContext()
  
  const [watcherState, setWatcherState] = useState<FileWatcherState>({
    isWatching: false,
    watchedPath: null,
    lastChangeTime: null,
    changeCount: 0,
  })
  
  const watcherRef = useRef<(() => void) | null>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const changeQueueRef = useRef<FileChangeEvent[]>([])
  
  // Use refs for stable context access
  const modContextRef = useRef(modContext)
  const uiContextRef = useRef(uiContext)
  const settingsContextRef = useRef(settingsContext)
  
  // Error recovery circuit breaker
  const errorCountRef = useRef(0)
  const lastErrorTimeRef = useRef<number>(0)
  const maxErrors = 5
  const errorResetTime = 60000 // 1 minute
  
  // Update refs when contexts change
  modContextRef.current = modContext
  uiContextRef.current = uiContext
  settingsContextRef.current = settingsContext

  // Circuit breaker helper
  const shouldBlockOperation = useCallback(() => {
    const now = Date.now()
    if (now - lastErrorTimeRef.current > errorResetTime) {
      errorCountRef.current = 0
    }
    return errorCountRef.current >= maxErrors
  }, [])

  const recordError = useCallback(() => {
    errorCountRef.current++
    lastErrorTimeRef.current = Date.now()
    console.warn(`File watcher error count: ${errorCountRef.current}/${maxErrors}`)
  }, [])

  // Process accumulated changes - stable version without unstable dependencies
  const processChangeQueue = useCallback(async () => {
    const changes = [...changeQueueRef.current]
    changeQueueRef.current = []

    if (changes.length === 0) {
      return
    }

    try {
      // Group changes by type
      const addedFiles = changes.filter(c => c.type === 'add').map(c => c.path)
      const removedFiles = changes.filter(c => c.type === 'unlink').map(c => c.path)
      const modifiedFiles = changes.filter(c => c.type === 'change').map(c => c.path)

      console.log('Processing file changes:', {
        added: addedFiles.length,
        removed: removedFiles.length,
        modified: modifiedFiles.length,
      })

      // Show notification for significant changes
      if (addedFiles.length > 0 || removedFiles.length > 0) {
        const message = []
        if (addedFiles.length > 0) {
          message.push(`${addedFiles.length} mod${addedFiles.length !== 1 ? 's' : ''} added`)
        }
        if (removedFiles.length > 0) {
          message.push(`${removedFiles.length} mod${removedFiles.length !== 1 ? 's' : ''} removed`)
        }
        if (modifiedFiles.length > 0) {
          message.push(`${modifiedFiles.length} mod${modifiedFiles.length !== 1 ? 's' : ''} modified`)
        }

        // Only show notification if auto-refresh is enabled
        if (settingsContextRef.current.settings.autoRefreshMods) {
          uiContextRef.current.showNotification({
            type: 'info',
            title: 'Mod directory changed',
            message: message.join(', ') + '. Refreshing mod list...',
            duration: 3000,
          })
        }
      }

      // Refresh mod list if auto-refresh is enabled
      if (settingsContextRef.current.settings.autoRefreshMods) {
        await modContextRef.current.refreshMods()
      } else {
        // Show manual refresh suggestion
        uiContextRef.current.showNotification({
          type: 'info',
          title: 'Mod directory changed',
          message: 'Click refresh to update the mod list.',
          duration: 0,
          action: {
            label: 'Refresh',
            onClick: () => {
              modContextRef.current.refreshMods()
              uiContextRef.current.clearAllNotifications()
            },
          },
        })
      }
    } catch (error) {
      console.error('Error processing file changes:', error)
      
      uiContextRef.current.showNotification({
        type: 'error',
        title: 'Error processing changes',
        message: 'Failed to process mod directory changes.',
        duration: 5000,
      })
    }
  }, [])

  // Handle individual file changes - stable version
  const handleFileChange = useCallback((event: FileChangeEvent) => {
    const { type, path, timestamp } = event

    // Filter out non-mod files
    const isModFile = path.toLowerCase().endsWith('.pak') || 
                     path.toLowerCase().endsWith('.rar') || 
                     path.toLowerCase().endsWith('.zip')

    if (!isModFile) {
      return
    }

    // Add to change queue
    changeQueueRef.current.push(event)

    // Update watcher state
    setWatcherState(prev => ({
      ...prev,
      lastChangeTime: timestamp,
      changeCount: prev.changeCount + 1,
    }))

    // Debounce the refresh to avoid excessive updates
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      processChangeQueue()
    }, 2000) // Wait 2 seconds after last change

    console.log(`File ${type}:`, path)
  }, [processChangeQueue])

  // Start watching the mod directory - stable version with circuit breaker
  const startWatching = useCallback(async () => {
    const modDirectory = settingsContextRef.current.settings.modDirectory
    
    if (!modDirectory || watcherState.isWatching) {
      return
    }

    // Circuit breaker check
    if (shouldBlockOperation()) {
      console.warn('File watcher blocked due to excessive errors. Will retry after cooldown.')
      return
    }

    try {
      // Check if directory exists
      const directoryExists = await window.electronAPI.fs.exists(modDirectory)
      if (!directoryExists) {
        console.warn('Mod directory does not exist:', modDirectory)
        return
      }

      // Start file watcher
      const unsubscribe = await window.electronAPI.events.onFileChange((event) => {
        handleFileChange({
          type: event.type,
          path: event.path,
          timestamp: new Date(event.timestamp),
        })
      })

      // Initialize watcher via IPC
      await window.electronAPI.fs.watchDirectory(modDirectory)

      watcherRef.current = unsubscribe
      setWatcherState(prev => ({
        ...prev,
        isWatching: true,
        watchedPath: modDirectory,
      }))

      console.log('File watcher started for:', modDirectory)
      
      // Reset error count on success
      errorCountRef.current = 0
    } catch (error) {
      console.error('Failed to start file watcher:', error)
      recordError()
      
      // Stable error notification
      try {
        const isBlocked = errorCountRef.current >= maxErrors
        uiContextRef.current.showNotification({
          type: 'warning',
          title: isBlocked ? 'File watcher disabled' : 'File watcher unavailable',
          message: isBlocked 
            ? 'File watcher has been temporarily disabled due to repeated failures.'
            : 'Could not start monitoring mod directory for changes.',
          duration: 5000,
        })
      } catch (notificationError) {
        // Fallback if notification fails
        console.warn('Could not show notification:', notificationError)
      }
    }
  }, [watcherState.isWatching, handleFileChange, shouldBlockOperation, recordError])

  // Stop watching
  const stopWatching = useCallback(async () => {
    if (!watcherState.isWatching) {
      return
    }

    try {
      // Stop file watcher
      if (watcherRef.current) {
        watcherRef.current()
        watcherRef.current = null
      }

      // Stop watcher via IPC
      await window.electronAPI.fs.unwatchDirectory()

      setWatcherState(prev => ({
        ...prev,
        isWatching: false,
        watchedPath: null,
      }))

      // Clear any pending debounced refresh
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
        debounceTimeoutRef.current = null
      }

      console.log('File watcher stopped')
    } catch (error) {
      console.error('Failed to stop file watcher:', error)
    }
  }, [watcherState.isWatching])

  // Restart watcher when mod directory changes
  useEffect(() => {
    if (watcherState.isWatching && 
        watcherState.watchedPath !== settingsContextRef.current.settings.modDirectory) {
      stopWatching().then(() => {
        if (settingsContextRef.current.settings.modDirectory) {
          startWatching()
        }
      })
    }
  }, [watcherState.isWatching, watcherState.watchedPath, stopWatching, startWatching])

  // Auto-start watcher when component mounts and settings are available
  useEffect(() => {
    if (!settingsContextRef.current.isLoading && 
        settingsContextRef.current.settings.modDirectory && 
        !watcherState.isWatching &&
        settingsContextRef.current.settings.autoRefreshMods) {
      startWatching()
    }
  }, [watcherState.isWatching, startWatching])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      stopWatching()
    }
  }, [stopWatching])

  // Manual refresh with change detection
  const refreshWithChangeDetection = useCallback(async () => {
    try {
      const beforeCount = modContextRef.current.mods.length
      await modContextRef.current.refreshMods()
      const afterCount = modContextRef.current.mods.length
      
      const changeCount = Math.abs(afterCount - beforeCount)
      if (changeCount > 0) {
        const message = afterCount > beforeCount 
          ? `Found ${changeCount} new mod${changeCount !== 1 ? 's' : ''}`
          : `Removed ${changeCount} mod${changeCount !== 1 ? 's' : ''}`
        
        uiContextRef.current.showNotification({
          type: 'success',
          title: 'Mods refreshed',
          message,
          duration: 3000,
        })
      }
    } catch (error) {
      console.error('Error during manual refresh:', error)
    }
  }, [])

  // Get watcher statistics
  const getWatcherStats = useCallback(() => {
    return {
      isActive: watcherState.isWatching,
      watchedDirectory: watcherState.watchedPath,
      lastChange: watcherState.lastChangeTime,
      totalChanges: watcherState.changeCount,
      queuedChanges: changeQueueRef.current.length,
    }
  }, [watcherState])

  return {
    // State
    isWatching: watcherState.isWatching,
    watchedPath: watcherState.watchedPath,
    lastChangeTime: watcherState.lastChangeTime,
    changeCount: watcherState.changeCount,
    
    // Controls
    startWatching,
    stopWatching,
    
    // Manual operations
    refreshWithChangeDetection,
    
    // Statistics
    getWatcherStats,
  }
}