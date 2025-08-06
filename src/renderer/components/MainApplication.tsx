import { useEffect, useState, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'

import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'
import { ModCard } from './ModCard'
import { DetailsPanel } from './DetailsPanel'
import { SettingsDialog } from './SettingsDialog'
import { EditMetadataModal } from './EditMetadataModal'
import { ModSelectionModal } from './ModSelectionModal'
import { ToastContainer } from './ToastContainer'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { cn } from 'renderer/lib/utils'

import { useMods, useSettings, useTheme, useFileWatcher } from '../hooks'
import { useUIContext } from '../contexts'
import type { ModInfo, SortBy, ModMetadata, ModGroup, ExtractedModGroups } from 'shared/types'

interface MainApplicationProps {
  className?: string
}

export function MainApplication({ className }: MainApplicationProps) {
  const {
    filteredMods,
    selectedMod,
    selectedCategory,
    selectedCharacter,
    searchQuery,
    categoryStats,
    characterStats,
    isLoading,
    isRefreshing,
    organizationProgress,
    error,
    selectModAndShowDetails,
    enableModWithFeedback,
    deleteModWithConfirmation,
    openModFolder,
    refreshModsWithFeedback,
    updateModMetadata,
    setSelectedCategory,
    setSelectedCharacter,
    setSearchQuery,
    getModStatistics,
  } = useMods()

  const {
    settings,
    setThemeAndSync,
    setViewModeAndSync,
  } = useSettings()

  const { currentTheme } = useTheme()

  const {
    viewMode,
    isDetailsPanelVisible,
    showDetailsPanel,
    hideDetailsPanel,
    openSettings,
    isDragOver,
    setDragOver,
    showNotification,
  } = useUIContext()

  const { isWatching } = useFileWatcher()

  const [dragCounter, setDragCounter] = useState(0)
  const [sortBy, setSortBy] = useState<SortBy>('installDate')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingMod, setEditingMod] = useState<ModInfo | null>(null)
  const [modEditQueue, setModEditQueue] = useState<ModInfo[]>([])
  
  // Mod selection modal state
  const [isModSelectionModalOpen, setIsModSelectionModalOpen] = useState(false)
  const [modSelectionGroups, setModSelectionGroups] = useState<ModGroup[]>([])
  const [extractedTempDir, setExtractedTempDir] = useState<string>('')

  const stats = getModStatistics()

  // Sort the filtered mods based on selected sort option
  const sortedMods = useMemo(() => {
    const modsToSort = [...filteredMods]
    
    switch (sortBy) {
      case 'installDate':
        return modsToSort.sort((a, b) => new Date(b.installDate).getTime() - new Date(a.installDate).getTime())
      case 'category':
        return modsToSort.sort((a, b) => a.category.localeCompare(b.category))
      case 'character':
        return modsToSort.sort((a, b) => {
          const aChar = a.character || 'zzz' // Put mods without character at the end
          const bChar = b.character || 'zzz'
          return aChar.localeCompare(bChar)
        })
      default:
        return modsToSort
    }
  }, [filteredMods, sortBy])

  // Handle file drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setDragCounter(prev => prev + 1)
    if (e.dataTransfer.types.includes('Files')) {
      setDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setDragCounter(prev => prev - 1)
    if (dragCounter <= 1) {
      setDragOver(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setDragOver(false)
    setDragCounter(0)
    
    const files = Array.from(e.dataTransfer.files)
    const modFiles = files.filter(file => 
      file.name.toLowerCase().endsWith('.pak') ||
      file.name.toLowerCase().endsWith('.zip') ||
      file.name.toLowerCase().endsWith('.rar')
    )
    
    if (modFiles.length > 0) {
      try {
        for (const file of modFiles) {
          const filePath = (file as any).path
          
          if (!filePath) {
            console.warn(`[MainApp] File path not available for ${file.name}, using FileReader approach`)
            
            try {
              // Use FileReader to read the file as buffer when path is not available
              const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as ArrayBuffer)
                reader.onerror = () => reject(reader.error)
                reader.readAsArrayBuffer(file)
              })
              
              console.log(`[MainApp] Successfully read ${file.name} as buffer (${fileBuffer.byteLength} bytes)`)
              
              // Send buffer to main process to create temp file
              const bufferResult = await window.electronAPI.dragDrop.handleFileBuffer({
                name: file.name,
                buffer: fileBuffer,
                size: file.size,
                type: file.type
              })
              
              console.log(`[MainApp] Buffer processing complete, shouldExtractAndGroup: ${bufferResult.shouldExtractAndGroup}`)
              
              if (bufferResult.shouldExtractAndGroup) {
                // Archive file - use extractAndGroup workflow (same as regular file-based drag drop)
                console.log(`[MainApp] Processing buffer-based archive: ${file.name}`)
                
                try {
                  const extractedGroups = await window.electronAPI.dragDrop.extractAndGroup(bufferResult.tempFilePath)
                  
                  console.log(`[MainApp] Buffer extraction successful! Groups: ${extractedGroups.groups.length}, isSingleMod: ${extractedGroups.isSingleMod}`)
                  
                  // Show notification about extraction results
                  const groupSummary = extractedGroups.groups
                    .map((group, index) => `${index + 1}. ${group.name}${group.folder ? ` (from ${group.folder})` : ''}`)
                    .join('\n')
                  
                  showNotification({
                    type: 'info',
                    title: 'Archive processed',
                    message: extractedGroups.isSingleMod
                      ? `Single mod detected: ${extractedGroups.groups[0].name}${extractedGroups.groups[0].folder ? ` from ${extractedGroups.groups[0].folder} folder` : ''}`
                      : `Found ${extractedGroups.groups.length} mod variations:\n${groupSummary}`,
                    duration: 8000,
                  })
                  
                  if (extractedGroups.isSingleMod) {
                    console.log(`[MainApp] Single mod detected in buffer archive, installing directly...`)
                    
                    // Single mod - install directly and show metadata editor
                    const selectedMods = await window.electronAPI.dragDrop.installSelected(
                      extractedGroups.groups, 
                      extractedGroups.tempDirectory
                    )
                    
                    console.log(`[MainApp] Buffer installation complete, installed ${selectedMods.length} mods`)
                    
                    // Cleanup temp directory
                    await window.electronAPI.dragDrop.cleanupTemp(extractedGroups.tempDirectory)
                    
                    // Refresh mods list
                    await refreshModsWithFeedback()
                    
                    // Add to metadata editing queue
                    if (selectedMods.length > 0) {
                      console.log(`[MainApp] Adding buffer-installed mods to edit queue and opening metadata editor`)
                      setModEditQueue(selectedMods)
                      setEditingMod(selectedMods[0])
                      setIsEditModalOpen(true)
                    }
                    
                    // Show success notification
                    showNotification({
                      type: 'success',
                      title: 'Archive installed successfully',
                      message: `${file.name} extracted and installed using buffer-based processing.`,
                      duration: 4000,
                    })
                  } else {
                    console.log(`[MainApp] Multiple mods detected in buffer archive, showing selection modal...`)
                    
                    // Multiple mods - show selection modal
                    setModSelectionGroups(extractedGroups.groups)
                    setExtractedTempDir(extractedGroups.tempDirectory)
                    setIsModSelectionModalOpen(true)
                    
                    // Show success notification for multi-mod extraction
                    showNotification({
                      type: 'success',
                      title: 'Multiple mods found',
                      message: `Found ${extractedGroups.groups.length} mod variations in ${file.name}. Choose which ones to install.`,
                      duration: 5000,
                    })
                  }
                } catch (error) {
                  console.error(`[MainApp] Buffer-based multi-mod extraction failed for ${file.name}:`, error)
                  
                  showNotification({
                    type: 'error',
                    title: 'Archive Processing Failed',
                    message: `Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    duration: 6000,
                  })
                }
              } else {
                // Direct .pak file - already installed by handleFileBuffer
                console.log(`[MainApp] Buffer-based .pak file installation complete`)
                
                // Refresh mods list to show the new mod
                await refreshModsWithFeedback()
                
                // Find the installed mod and add to metadata editing queue
                const allMods = await window.electronAPI.mod.getAll()
                const installedMod = allMods.find(mod => mod.filePath.includes(file.name.replace('.pak', '')))
                
                if (installedMod) {
                  console.log(`[MainApp] Adding buffer-installed .pak mod to edit queue`)
                  setModEditQueue([installedMod])
                  setEditingMod(installedMod)
                  setIsEditModalOpen(true)
                }
                
                showNotification({
                  type: 'success',
                  title: 'Mod installed successfully',
                  message: `${file.name} installed using buffer-based processing.`,
                  duration: 4000,
                })
              }
              
              continue // Skip the rest of the processing for this file
            } catch (bufferError) {
              console.error(`[MainApp] Buffer-based processing failed for ${file.name}:`, bufferError)
              showNotification({
                type: 'error',
                title: 'Installation Failed',
                message: `Failed to process ${file.name}: File path not available and buffer processing failed.`,
                duration: 5000,
              })
              continue
            }
          }
          
          const isArchive = file.name.toLowerCase().endsWith('.zip') || 
                           file.name.toLowerCase().endsWith('.rar')
          
          if (isArchive) {
            console.log(`[MainApp] Processing archive file: ${file.name}`)
            console.log(`[MainApp] File path: ${filePath}`)
            
            try {
              console.log(`[MainApp] Attempting multi-mod extraction and grouping...`)
              
              // Try new multi-mod extraction and grouping
              const extractedGroups = await window.electronAPI.dragDrop.extractAndGroup(filePath)
              
              console.log(`[MainApp] Extraction successful! Groups: ${extractedGroups.groups.length}, isSingleMod: ${extractedGroups.isSingleMod}`)
              console.log(`[MainApp] Detailed group analysis:`)
              extractedGroups.groups.forEach((group, index) => {
                console.log(`  Group ${index + 1}:`)
                console.log(`    - Name: ${group.name}`)
                console.log(`    - PAK file: ${group.pakFile}`)
                console.log(`    - Associated files: ${group.associatedFiles.length}`)
                console.log(`    - Folder: ${group.folder || 'None'}`)
                console.log(`    - Size: ${group.size} bytes`)
                if (group.associatedFiles.length > 0) {
                  console.log(`    - Associated file list:`, group.associatedFiles)
                }
              })
              console.log(`[MainApp] Decision logic: Groups=${extractedGroups.groups.length} → isSingleMod=${extractedGroups.isSingleMod}`)
              
              // Add comprehensive notification showing what was found
              const groupSummary = extractedGroups.groups.map((group, index) => 
                `${index + 1}. ${group.name}${group.folder ? ` (in ${group.folder})` : ''} + ${group.associatedFiles.length} files`
              ).join('\n')
              
              showNotification({
                type: 'info',
                title: 'Archive Analysis Complete',
                message: extractedGroups.groups.length === 1 
                  ? `Single mod detected: ${extractedGroups.groups[0].name}${extractedGroups.groups[0].folder ? ` from ${extractedGroups.groups[0].folder} folder` : ''}`
                  : `Found ${extractedGroups.groups.length} mod variations:\n${groupSummary}`,
                duration: 8000,
              })
              
              if (extractedGroups.isSingleMod) {
                console.log(`[MainApp] Single mod detected, installing directly...`)
                
                // Single mod - install directly and show metadata editor
                const selectedMods = await window.electronAPI.dragDrop.installSelected(
                  extractedGroups.groups, 
                  extractedGroups.tempDirectory
                )
                
                console.log(`[MainApp] Installation complete, installed ${selectedMods.length} mods`)
                
                // Cleanup temp directory
                await window.electronAPI.dragDrop.cleanupTemp(extractedGroups.tempDirectory)
                
                // Refresh mods list
                await refreshModsWithFeedback()
                
                // Add to metadata editing queue
                if (selectedMods.length > 0) {
                  console.log(`[MainApp] Adding mods to edit queue and opening metadata editor`)
                  setModEditQueue(selectedMods)
                  setEditingMod(selectedMods[0])
                  setIsEditModalOpen(true)
                }
                
                // Show success notification for advanced extraction
                showNotification({
                  type: 'success',
                  title: 'Archive extracted successfully',
                  message: `${file.name} extracted and installed using advanced extraction method.`,
                  duration: 4000,
                })
              } else {
                console.log(`[MainApp] Multiple mods detected, showing selection modal...`)
                
                // Multiple mods - show selection modal
                setModSelectionGroups(extractedGroups.groups)
                setExtractedTempDir(extractedGroups.tempDirectory)
                setIsModSelectionModalOpen(true)
                
                // Show success notification for multi-mod extraction
                showNotification({
                  type: 'success',
                  title: 'Multiple mods found',
                  message: `Found ${extractedGroups.groups.length} mod variations in ${file.name}. Choose which ones to install.`,
                  duration: 5000,
                })
              }
            } catch (error) {
              console.error(`[MainApp] Multi-mod extraction failed for ${file.name}:`, error)
              console.error(`[MainApp] Error details:`, {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
              })
              
              // Add detailed error notification
              showNotification({
                type: 'warning',
                title: 'Advanced Extraction Failed',
                message: `Could not process ${file.name} with advanced extraction: ${error instanceof Error ? error.message : 'Unknown error'}. Trying fallback method...`,
                duration: 6000,
              })
              
              // Fall back to original extraction method
              try {
                console.log(`[MainApp] Attempting fallback to legacy extraction method...`)
                
                const installedMods = await window.electronAPI.dragDrop.handleDroppedFiles(
                  (() => {
                    const dt = new DataTransfer()
                    dt.items.add(file)
                    return dt.files
                  })()
                )
                
                console.log(`[MainApp] Fallback extraction successful, installed ${installedMods.length} mods`)
                
                // Refresh mods list
                await refreshModsWithFeedback()
                
                // Add to metadata editing queue
                if (installedMods.length > 0) {
                  console.log(`[MainApp] Adding fallback mods to edit queue`)
                  setModEditQueue(installedMods)
                  setEditingMod(installedMods[0])
                  setIsEditModalOpen(true)
                }
                
                // Show notification about extraction method used
                if (file.name.toLowerCase().endsWith('.rar')) {
                  showNotification({
                    type: 'info',
                    title: 'RAR file installed',
                    message: 'RAR file installed successfully using basic extraction. Advanced multi-mod selection not available for RAR files.',
                    duration: 6000,
                  })
                } else {
                  showNotification({
                    type: 'warning',
                    title: 'Extraction method changed',
                    message: 'Advanced extraction failed, but file installed successfully using basic method.',
                    duration: 5000,
                  })
                }
              } catch (fallbackError) {
                console.error(`[MainApp] Both extraction methods failed for ${file.name}:`, fallbackError)
                console.error(`[MainApp] Fallback error details:`, {
                  name: fallbackError instanceof Error ? fallbackError.name : 'Unknown',
                  message: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
                  stack: fallbackError instanceof Error ? fallbackError.stack : undefined
                })
                throw fallbackError
              }
            }
          } else {
            // Direct .pak file - use existing flow
            const installedMods = await window.electronAPI.dragDrop.handleDroppedFiles(
              (() => {
                const dt = new DataTransfer()
                dt.items.add(file)
                return dt.files
              })()
            )
            
            // Refresh mods list
            await refreshModsWithFeedback()
            
            // Add to metadata editing queue
            if (installedMods.length > 0) {
              setModEditQueue(installedMods)
              setEditingMod(installedMods[0])
              setIsEditModalOpen(true)
            }
          }
        }
      } catch (error) {
        console.error('Error installing mods via drag and drop:', error)
        showNotification({
          type: 'error',
          title: 'Installation Failed',
          message: error instanceof Error ? error.message : 'Failed to install mods',
        })
      }
    }
  }

  const handleAddMod = async () => {
    console.log(`[MainApp] Add mod button clicked`)
    
    try {
      console.log(`[MainApp] Opening file selection dialog...`)
      
      const filePaths = await window.electronAPI.fs.selectFiles({
        filters: [
          { name: 'Mod Files', extensions: ['pak', 'zip', 'rar'] },
          { name: 'PAK Files', extensions: ['pak'] },
          { name: 'Archive Files', extensions: ['zip', 'rar'] },
        ],
        properties: ['openFile', 'multiSelections'],
      })
      
      console.log(`[MainApp] File selection result:`, filePaths)
      
      if (filePaths && filePaths.length > 0) {
        console.log(`[MainApp] Processing ${filePaths.length} selected files...`)
        const installedMods: ModInfo[] = []
        
        // Process each file
        for (const filePath of filePaths) {
          try {
            const isArchive = filePath.toLowerCase().endsWith('.zip') || 
                             filePath.toLowerCase().endsWith('.rar')
            
            if (isArchive) {
              const fileName = filePath.split(/[/\\\\]/).pop() || 'Unknown file'
              console.log(`[MainApp] Processing archive via file browser: ${fileName}`)
              console.log(`[MainApp] File path: ${filePath}`)
              
              try {
                console.log(`[MainApp] Attempting multi-mod extraction for file browser selection...`)
                
                // Try new multi-mod extraction and grouping
                const extractedGroups = await window.electronAPI.dragDrop.extractAndGroup(filePath)
                
                console.log(`[MainApp] File browser extraction successful! Groups: ${extractedGroups.groups.length}, isSingleMod: ${extractedGroups.isSingleMod}`)
                console.log(`[MainApp] File browser detailed group analysis:`)
                extractedGroups.groups.forEach((group, index) => {
                  console.log(`  Group ${index + 1}:`)
                  console.log(`    - Name: ${group.name}`)
                  console.log(`    - PAK file: ${group.pakFile}`)
                  console.log(`    - Associated files: ${group.associatedFiles.length}`)
                  console.log(`    - Folder: ${group.folder || 'None'}`)
                  console.log(`    - Size: ${group.size} bytes`)
                })
                console.log(`[MainApp] File browser decision logic: Groups=${extractedGroups.groups.length} → isSingleMod=${extractedGroups.isSingleMod}`)
                
                // Add comprehensive notification for file browser
                const fileBrowserGroupSummary = extractedGroups.groups.map((group, index) => 
                  `${index + 1}. ${group.name}${group.folder ? ` (in ${group.folder})` : ''} + ${group.associatedFiles.length} files`
                ).join('\n')
                
                showNotification({
                  type: 'info',
                  title: 'File Browser Analysis',
                  message: extractedGroups.groups.length === 1 
                    ? `Single mod found: ${extractedGroups.groups[0].name}${extractedGroups.groups[0].folder ? ` from ${extractedGroups.groups[0].folder} folder` : ''}`
                    : `Found ${extractedGroups.groups.length} mod variations in ${fileName}:\n${fileBrowserGroupSummary}`,
                  duration: 8000,
                })
                
                if (extractedGroups.isSingleMod) {
                  console.log(`[MainApp] Single mod detected in file browser, installing directly...`)
                  
                  // Single mod - install directly
                  const selectedMods = await window.electronAPI.dragDrop.installSelected(
                    extractedGroups.groups, 
                    extractedGroups.tempDirectory
                  )
                  
                  console.log(`[MainApp] File browser installation complete, installed ${selectedMods.length} mods`)
                  
                  // Cleanup temp directory
                  await window.electronAPI.dragDrop.cleanupTemp(extractedGroups.tempDirectory)
                  
                  // Add to installed list
                  installedMods.push(...selectedMods)
                } else {
                  console.log(`[MainApp] Multiple mods detected in file browser - falling back to simple install for now`)
                  
                  // Multiple mods - for file browser, fall back to existing method for now
                  // Future enhancement: could show selection modal here too
                  const installedMod = await window.electronAPI.mod.install(filePath)
                  installedMods.push(installedMod)
                }
              } catch (error) {
                console.error(`[MainApp] Multi-mod extraction failed for file browser ${fileName}:`, error)
                console.error(`[MainApp] File browser error details:`, {
                  name: error instanceof Error ? error.name : 'Unknown',
                  message: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined
                })
                
                // Add detailed error notification for file browser
                showNotification({
                  type: 'warning',
                  title: 'File Browser Advanced Extraction Failed',
                  message: `Could not process ${fileName} with advanced extraction: ${error instanceof Error ? error.message : 'Unknown error'}. Trying fallback method...`,
                  duration: 6000,
                })
                
                console.log(`[MainApp] Attempting fallback to legacy method for file browser...`)
                
                // Fall back to original installation method
                try {
                  const installedMod = await window.electronAPI.mod.install(filePath)
                  installedMods.push(installedMod)
                  
                  console.log(`[MainApp] File browser fallback installation successful for ${fileName}`)
                  
                  // Show notification about extraction method used
                  if (filePath.toLowerCase().endsWith('.rar')) {
                    showNotification({
                      type: 'info',
                      title: 'RAR file installed',
                      message: 'RAR file installed successfully using basic extraction. Advanced multi-mod selection not available for RAR files.',
                      duration: 6000,
                    })
                  } else {
                    showNotification({
                      type: 'warning',
                      title: 'Extraction method changed',
                      message: `${fileName} installed successfully using basic extraction instead of advanced method.`,
                      duration: 5000,
                    })
                  }
                } catch (fallbackError) {
                  console.error(`[MainApp] Both extraction methods failed for file browser ${fileName}:`, fallbackError)
                  console.error(`[MainApp] File browser fallback error details:`, {
                    name: fallbackError instanceof Error ? fallbackError.name : 'Unknown',
                    message: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
                    stack: fallbackError instanceof Error ? fallbackError.stack : undefined
                  })
                  
                  // Don't break the loop for other files - just log the error
                  showNotification({
                    type: 'error',
                    title: 'Installation Failed',
                    message: `Failed to install ${fileName}: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`,
                    duration: 7000,
                  })
                }
              }
            } else {
              // Direct .pak file
              const installedMod = await window.electronAPI.mod.install(filePath)
              installedMods.push(installedMod)
            }
          } catch (error) {
            const fileName = filePath.split(/[/\\\\]/).pop() || 'Unknown file'
            console.error(`[MainApp] Error installing individual file ${fileName}:`, error)
            console.error(`[MainApp] Individual file error details:`, {
              name: error instanceof Error ? error.name : 'Unknown',
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            })
            
            showNotification({
              type: 'error',
              title: 'Installation Failed',
              message: `Failed to install ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              duration: 7000,
            })
          }
        }
        
        console.log(`[MainApp] File processing complete. Successfully installed ${installedMods.length} mods`)
        
        // Refresh mods list first
        await refreshModsWithFeedback()
        
        // Add all installed mods to the edit queue
        if (installedMods.length > 0) {
          console.log(`[MainApp] Adding ${installedMods.length} installed mods to edit queue`)
          setModEditQueue(installedMods)
          setEditingMod(installedMods[0])
          setIsEditModalOpen(true)
        } else {
          console.log(`[MainApp] No mods were successfully installed`)
        }
      } else {
        console.log(`[MainApp] No files selected or file selection cancelled`)
      }
    } catch (error) {
      console.error(`[MainApp] Error in handleAddMod:`, error)
      console.error(`[MainApp] handleAddMod error details:`, {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      
      showNotification({
        type: 'error',
        title: 'Installation Failed',
        message: error instanceof Error ? error.message : 'Failed to install mods',
        duration: 7000,
      })
    }
  }

  const handleModSelect = (mod: ModInfo) => {
    selectModAndShowDetails(mod)
  }

  const handleModEdit = (mod: ModInfo) => {
    setEditingMod(mod)
    setIsEditModalOpen(true)
  }

  const handleSaveMetadata = async (modId: string, metadata: Partial<ModMetadata>) => {
    try {
      // Use ModContext method which handles backend update + state synchronization
      await updateModMetadata(modId, metadata)
      
      // Update local editingMod state if it matches the updated mod
      if (editingMod && editingMod.id === modId) {
        // Get the updated mod info from the context
        const updatedMod = filteredMods.find(mod => mod.id === modId) || 
                          selectedMod?.id === modId ? selectedMod : null
        if (updatedMod) {
          setEditingMod(updatedMod)
        }
      }
      
      // Refresh to ensure UI is fully synchronized
      await refreshModsWithFeedback()
      
      // Process next mod in queue after successful save
      if (modEditQueue.length > 1) {
        const remainingQueue = modEditQueue.slice(1)
        setModEditQueue(remainingQueue)
        setEditingMod(remainingQueue[0])
        // Close current modal and open next
        setIsEditModalOpen(false)
        setTimeout(() => {
          setIsEditModalOpen(true)
        }, 100)
      } else {
        setModEditQueue([])
      }
    } catch (error) {
      console.error('Error updating metadata:', error)
      throw error
    }
  }

  const handleCloseEditModal = () => {
    console.log(`[MainApp] Cancel button clicked. Queue length: ${modEditQueue.length}`)
    
    setIsEditModalOpen(false)
    setEditingMod(null)
    
    // Check if there are more mods after the current one
    const remainingQueue = modEditQueue.slice(1)
    
    if (remainingQueue.length > 0) {
      console.log(`[MainApp] ${remainingQueue.length} mods remaining in queue, advancing to next mod`)
      
      // There are more mods to edit, advance to the next one
      setModEditQueue(remainingQueue)
      setEditingMod(remainingQueue[0])
      
      // Use setTimeout to allow modal to close before reopening
      setTimeout(() => {
        setIsEditModalOpen(true)
      }, 100)
    } else {
      console.log(`[MainApp] No more mods in queue, clearing queue completely`)
      
      // No more mods left, clear the queue
      setModEditQueue([])
    }
  }

  // Mod selection modal handlers
  const handleModSelectionConfirm = async (selectedGroups: ModGroup[]) => {
    try {
      setIsModSelectionModalOpen(false)
      
      if (selectedGroups.length === 0) {
        // No mods selected - just cleanup
        await window.electronAPI.dragDrop.cleanupTemp(extractedTempDir)
        showNotification({
          type: 'info',
          title: 'No mods installed',
          message: 'No mods were selected for installation.',
        })
        return
      }
      
      // Install selected mods
      const installedMods = await window.electronAPI.dragDrop.installSelected(
        selectedGroups,
        extractedTempDir
      )
      
      // Cleanup temp directory
      await window.electronAPI.dragDrop.cleanupTemp(extractedTempDir)
      
      // Refresh mods list
      await refreshModsWithFeedback()
      
      // Add to metadata editing queue
      if (installedMods.length > 0) {
        setModEditQueue(installedMods)
        setEditingMod(installedMods[0])
        setIsEditModalOpen(true)
      }
      
      showNotification({
        type: 'success',
        title: 'Mods installed',
        message: `${selectedGroups.length} mod${selectedGroups.length !== 1 ? 's' : ''} installed successfully.`,
      })
    } catch (error) {
      console.error('Error installing selected mods:', error)
      showNotification({
        type: 'error',
        title: 'Installation Failed',
        message: error instanceof Error ? error.message : 'Failed to install selected mods',
      })
    } finally {
      // Reset state
      setModSelectionGroups([])
      setExtractedTempDir('')
    }
  }

  const handleModSelectionClose = async () => {
    setIsModSelectionModalOpen(false)
    
    // Cleanup temp directory when canceling
    if (extractedTempDir) {
      await window.electronAPI.dragDrop.cleanupTemp(extractedTempDir)
    }
    
    // Reset state
    setModSelectionGroups([])
    setExtractedTempDir('')
  }

  // Bulk action handlers
  const handleEnableAll = async () => {
    try {
      const modsToEnable = filteredMods.filter(mod => !mod.enabled)
      if (modsToEnable.length === 0) {
        showNotification({
          type: 'info',
          title: 'No mods to enable',
          message: 'All visible mods are already enabled.',
          duration: 3000,
        })
        return
      }
      
      let successCount = 0
      let errorCount = 0
      
      for (const mod of modsToEnable) {
        try {
          await window.electronAPI.mod.enable(mod.id, true)
          successCount++
        } catch (error) {
          console.error(`Error enabling mod ${mod.name}:`, error)
          errorCount++
        }
      }
      
      await refreshModsWithFeedback()
      
      if (errorCount === 0) {
        showNotification({
          type: 'success',
          title: 'Bulk Enable Complete',
          message: `Successfully enabled ${successCount} mod${successCount !== 1 ? 's' : ''}`,
          duration: 4000,
        })
      } else {
        showNotification({
          type: 'warning',
          title: 'Bulk Enable Completed with Errors',
          message: `Enabled ${successCount} mods, ${errorCount} failed`,
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error enabling all mods:', error)
      showNotification({
        type: 'error',
        title: 'Bulk Enable Failed',
        message: 'An error occurred while enabling mods',
        duration: 5000,
      })
    }
  }

  const handleDisableAll = async () => {
    try {
      const modsToDisable = filteredMods.filter(mod => mod.enabled)
      if (modsToDisable.length === 0) {
        showNotification({
          type: 'info',
          title: 'No mods to disable',
          message: 'All visible mods are already disabled.',
          duration: 3000,
        })
        return
      }
      
      let successCount = 0
      let errorCount = 0
      
      for (const mod of modsToDisable) {
        try {
          await window.electronAPI.mod.enable(mod.id, false)
          successCount++
        } catch (error) {
          console.error(`Error disabling mod ${mod.name}:`, error)
          errorCount++
        }
      }
      
      await refreshModsWithFeedback()
      
      if (errorCount === 0) {
        showNotification({
          type: 'success',
          title: 'Bulk Disable Complete',
          message: `Successfully disabled ${successCount} mod${successCount !== 1 ? 's' : ''}`,
          duration: 4000,
        })
      } else {
        showNotification({
          type: 'warning',
          title: 'Bulk Disable Completed with Errors',
          message: `Disabled ${successCount} mods, ${errorCount} failed`,
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error disabling all mods:', error)
      showNotification({
        type: 'error',
        title: 'Bulk Disable Failed',
        message: 'An error occurred while disabling mods',
        duration: 5000,
      })
    }
  }

  const handleDeleteAll = async () => {
    try {
      if (filteredMods.length === 0) {
        showNotification({
          type: 'info',
          title: 'No mods to delete',
          message: 'There are no mods to delete.',
          duration: 3000,
        })
        return
      }
      
      // Show confirmation dialog - temporarily use a simple confirm until dialog system is implemented
      const confirmed = confirm(
        `Are you sure you want to delete all ${filteredMods.length} mods? This action cannot be undone.`
      )
      
      if (!confirmed) return
      
      let successCount = 0
      let errorCount = 0
      
      for (const mod of filteredMods) {
        try {
          await window.electronAPI.mod.delete(mod.id)
          successCount++
        } catch (error) {
          console.error(`Error deleting mod ${mod.name}:`, error)
          errorCount++
        }
      }
      
      await refreshModsWithFeedback()
      
      if (errorCount === 0) {
        showNotification({
          type: 'success',
          title: 'Bulk Delete Complete',
          message: `Successfully deleted ${successCount} mod${successCount !== 1 ? 's' : ''}`,
          duration: 4000,
        })
      } else {
        showNotification({
          type: 'warning',
          title: 'Bulk Delete Completed with Errors',
          message: `Deleted ${successCount} mods, ${errorCount} failed`,
          duration: 5000,
        })
      }
      
      // Hide details panel if it was showing a deleted mod
      hideDetailsPanel()
    } catch (error) {
      console.error('Error deleting all mods:', error)
      showNotification({
        type: 'error',
        title: 'Bulk Delete Failed',
        message: 'An error occurred while deleting mods',
        duration: 5000,
      })
    }
  }

  const handleThumbnailSave = async (modId: string, imageUrl: string) => {
    try {
      const thumbnailPath = await window.electronAPI.thumbnail.saveFromUrl(modId, imageUrl)
      await refreshModsWithFeedback()
      return thumbnailPath
    } catch (error) {
      console.error('Error saving thumbnail:', error)
      throw error
    }
  }

  // Initialize theme on mount
  useEffect(() => {
    if (settings.theme !== currentTheme) {
      setThemeAndSync(settings.theme)
    }
  }, [settings.theme, currentTheme, setThemeAndSync])

  // Listen for startup completion
  useEffect(() => {
    const cleanup = window.electronAPI.events.onStartupComplete((result) => {
      if (result.errorCount === 0 && result.movedMods > 0) {
        showNotification({
          type: 'success',
          title: 'Startup Complete',
          message: `${result.movedMods} mod${result.movedMods !== 1 ? 's' : ''} organized and ready to use`,
          duration: 4000,
        })
      } else if (result.errorCount === 0) {
        showNotification({
          type: 'success', 
          title: 'Startup Complete',
          message: 'All mods are properly organized and ready to use',
          duration: 3000,
        })
      } else {
        showNotification({
          type: 'warning',
          title: 'Startup Complete with Issues',
          message: `${result.movedMods} mod${result.movedMods !== 1 ? 's' : ''} organized, ${result.errorCount} error${result.errorCount !== 1 ? 's' : ''} occurred`,
          duration: 5000,
        })
      }
    })

    return cleanup
  }, [showNotification])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + R: Refresh mods
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault()
        refreshModsWithFeedback()
      }
      
      // Ctrl/Cmd + O: Add mod
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        handleAddMod()
      }
      
      // Ctrl/Cmd + ,: Open settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        openSettings()
      }
      
      // Escape: Close details panel
      if (e.key === 'Escape' && isDetailsPanelVisible) {
        hideDetailsPanel()
      }
      
      // Ctrl/Cmd + T: Toggle theme
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault()
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
        setThemeAndSync(newTheme)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    currentTheme,
    isDetailsPanelVisible,
    refreshModsWithFeedback,
    setThemeAndSync,
    openSettings,
    hideDetailsPanel,
  ])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading Marvel Rivals Mod Manager...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Card className="p-6 max-w-md">
          <div className="text-center space-y-4">
            <h2 className="text-lg font-semibold text-destructive">Error Loading Application</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={refreshModsWithFeedback}>
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        'h-screen flex bg-background text-foreground overflow-hidden transition-colors duration-300',
        isDragOver && 'bg-accent/10',
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragOver && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <Card className="p-8 text-center border-2 border-dashed border-primary">
              <div className="space-y-4">
                <div className="w-16 h-16 border-4 border-primary border-dashed rounded-full flex items-center justify-center mx-auto">
                  <span className="text-2xl">📦</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Drop mod files here</h3>
                  <p className="text-muted-foreground">
                    Supports .pak, .zip, and .rar files
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <Sidebar
        selectedCategory={selectedCategory}
        selectedCharacter={selectedCharacter}
        categoryStats={categoryStats}
        characterStats={characterStats}
        onCategorySelect={setSelectedCategory}
        onCharacterSelect={setSelectedCharacter}
        onRefresh={refreshModsWithFeedback}
        isRefreshing={isRefreshing}
        onEnableAll={handleEnableAll}
        onDisableAll={handleDisableAll}
        onDeleteAll={handleDeleteAll}
        totalModCount={stats.total}
        className="flex-shrink-0 animate-slide-in"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <Toolbar
          searchQuery={searchQuery}
          viewMode={viewMode}
          sortBy={sortBy}
          totalMods={stats.total}
          enabledMods={stats.enabled}
          onSearchChange={setSearchQuery}
          onViewModeChange={setViewModeAndSync}
          onSortChange={setSortBy}
          onAddMod={handleAddMod}
          onOpenSettings={openSettings}
          className="flex-shrink-0 animate-fade-in"
        />

        {/* Mods Grid/List */}
        <div className="flex-1 overflow-auto p-4">
          {sortedMods.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                  <span className="text-2xl">🎮</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {searchQuery ? 'No mods found' : 'No mods installed'}
                  </h3>
                  <p className="text-muted-foreground">
                    {searchQuery 
                      ? `No mods match "${searchQuery}"`
                      : 'Get started by adding some mod files'
                    }
                  </p>
                </div>
                {!searchQuery && (
                  <Button onClick={handleAddMod} className="animate-scale-in">
                    Add Your First Mod
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className={cn(
              'gap-4 animate-fade-in',
              viewMode === 'grid' 
                ? 'flex flex-wrap justify-start'
                : 'flex flex-col space-y-2'
            )}>
              <AnimatePresence mode="popLayout">
                {sortedMods.map((mod) => (
                  <ModCard
                    key={mod.id}
                    mod={mod}
                    viewMode={viewMode}
                    isSelected={selectedMod?.id === mod.id}
                    onSelect={handleModSelect}
                    onToggleEnabled={enableModWithFeedback}
                    onEditMetadata={handleModEdit}
                    onDelete={deleteModWithConfirmation}
                    onOpenFolder={openModFolder}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Details Panel */}
      <DetailsPanel
        mod={selectedMod}
        isVisible={isDetailsPanelVisible}
        onClose={hideDetailsPanel}
        onToggleEnabled={enableModWithFeedback}
        onEditMetadata={handleModEdit}
        onDelete={deleteModWithConfirmation}
        onOpenFolder={openModFolder}
      />

      {/* Settings Dialog */}
      <SettingsDialog />

      {/* Edit Metadata Modal */}
      <EditMetadataModal
        mod={editingMod}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSave={handleSaveMetadata}
      />

      {/* Mod Selection Modal */}
      <ModSelectionModal
        modGroups={modSelectionGroups}
        isOpen={isModSelectionModalOpen}
        onClose={handleModSelectionClose}
        onConfirm={handleModSelectionConfirm}
      />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  )
}