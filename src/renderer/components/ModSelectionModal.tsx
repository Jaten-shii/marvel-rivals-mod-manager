import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Package, FolderOpen, X, Check } from 'lucide-react'

import { Button } from './ui/button'
import { Card } from './ui/card'
import type { ModGroup } from 'shared/types'
import { cn } from 'renderer/lib/utils'

interface ModSelectionModalProps {
  modGroups: ModGroup[]
  isOpen: boolean
  onClose: () => void
  onConfirm: (selectedGroups: ModGroup[]) => void
}

interface ColumnType {
  id: 'ignore' | 'install'
  title: string
  description: string
  groups: ModGroup[]
}

export function ModSelectionModal({ modGroups, isOpen, onClose, onConfirm }: ModSelectionModalProps) {
  // State for which groups are in which column
  const [ignoredGroups, setIgnoredGroups] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [draggedGroup, setDraggedGroup] = useState<ModGroup | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<'ignore' | 'install' | null>(null)

  // Calculate columns
  const columns: ColumnType[] = useMemo(() => {
    const ignored = modGroups.filter(group => ignoredGroups.has(group.id))
    const toInstall = modGroups.filter(group => !ignoredGroups.has(group.id))

    return [
      {
        id: 'ignore',
        title: 'Ignore',
        description: 'Mods that will not be installed',
        groups: ignored
      },
      {
        id: 'install',
        title: 'Install',
        description: 'Mods that will be installed',
        groups: toInstall
      }
    ]
  }, [modGroups, ignoredGroups])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  const handleDragStart = (group: ModGroup) => {
    setDraggedGroup(group)
  }

  const handleDragEnd = () => {
    setDraggedGroup(null)
    setDragOverColumn(null)
  }

  const handleDragOver = (e: React.DragEvent, columnId: 'ignore' | 'install') => {
    e.preventDefault()
    setDragOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e: React.DragEvent, columnId: 'ignore' | 'install') => {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedGroup) return

    setIgnoredGroups(prev => {
      const newSet = new Set(prev)
      if (columnId === 'ignore') {
        newSet.add(draggedGroup.id)
      } else {
        newSet.delete(draggedGroup.id)
      }
      return newSet
    })
  }


  const handleConfirm = () => {
    const selectedGroups = modGroups.filter(group => !ignoredGroups.has(group.id))
    onConfirm(selectedGroups)
  }

  const selectedCount = modGroups.length - ignoredGroups.size

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card rounded-lg border shadow-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Select Mods to Install</h2>
              <p className="text-muted-foreground mt-1">
                Choose which mods from this archive to install. Drag mods between columns or use the buttons.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span>Found {modGroups.length} mod{modGroups.length !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{selectedCount} selected for installation</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto scroll-smooth">
          <div className="grid grid-cols-2 gap-6">
            {columns.map((column) => (
              <div key={column.id} className="flex flex-col">
                {/* Column Header */}
                <div className={cn(
                  "p-4 rounded-t-lg border-2 border-dashed transition-colors",
                  column.id === 'ignore' ? "bg-destructive/10 border-destructive/30" : "bg-primary/10 border-primary/30",
                  dragOverColumn === column.id && "border-solid bg-opacity-20"
                )}>
                  <div className="flex items-center gap-2">
                    {column.id === 'ignore' ? (
                      <X className="h-5 w-5 text-destructive" />
                    ) : (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                    <h3 className="font-semibold text-lg">{column.title}</h3>
                    <span className="text-sm text-muted-foreground">({column.groups.length})</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{column.description}</p>
                </div>

                {/* Drop Zone */}
                <div
                  className={cn(
                    "flex-1 border-2 border-dashed border-t-0 rounded-b-lg p-4 transition-colors min-h-[200px]",
                    column.id === 'ignore' ? "border-destructive/30" : "border-primary/30",
                    dragOverColumn === column.id && "border-solid bg-accent/50"
                  )}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, column.id)}
                >
                  <AnimatePresence>
                    {column.groups.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-muted-foreground">
                        <div className="text-center">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Drop mods here</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {column.groups.map((group) => (
                          <motion.div
                            key={group.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Card
                              className={cn(
                                "p-3 cursor-grab active:cursor-grabbing transition-colors",
                                draggedGroup?.id === group.id && "opacity-50"
                              )}
                              draggable
                              onDragStart={() => handleDragStart(group)}
                              onDragEnd={handleDragEnd}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <Package className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium truncate">{group.name}</h4>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                      <span>{formatFileSize(group.size)}</span>
                                      {group.folder && (
                                        <>
                                          <span>•</span>
                                          <div className="flex items-center gap-1">
                                            <FolderOpen className="h-3 w-3" />
                                            <span className="truncate">{group.folder}</span>
                                          </div>
                                        </>
                                      )}
                                      {group.associatedFiles.length > 0 && (
                                        <>
                                          <span>•</span>
                                          <span>+{group.associatedFiles.length} files</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {/* Expand button */}
                                  {group.associatedFiles.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2"
                                      onClick={() => toggleGroupExpanded(group.id)}
                                    >
                                      {expandedGroups.has(group.id) ? (
                                        <ChevronDown className="h-3 w-3" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Associated files */}
                              <AnimatePresence>
                                {expandedGroups.has(group.id) && group.associatedFiles.length > 0 && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="mt-3 pt-3 border-t border-border"
                                  >
                                    <p className="text-xs text-muted-foreground mb-2">Associated files:</p>
                                    <div className="space-y-1">
                                      {group.associatedFiles.map((file, index) => (
                                        <div key={index} className="text-xs text-muted-foreground pl-6">
                                          • {file.split(/[/\\]/).pop()}
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedCount} of {modGroups.length} mods will be installed
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={selectedCount === 0}
              >
                Install Selected ({selectedCount})
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}