import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import type { ModInfo } from 'shared/types'

interface ContextMenuItem {
  id: string
  label: string
  icon: ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  items: ContextMenuItem[]
}

interface ContextMenuContextType {
  contextMenu: ContextMenuState
  showContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void
  hideContextMenu: () => void
}

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined)

export function useContextMenu() {
  const context = useContext(ContextMenuContext)
  if (context === undefined) {
    throw new Error('useContextMenu must be used within a ContextMenuProvider')
  }
  return context
}

interface ContextMenuProviderProps {
  children: ReactNode
}

export function ContextMenuProvider({ children }: ContextMenuProviderProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    items: []
  })

  const showContextMenu = useCallback((x: number, y: number, items: ContextMenuItem[]) => {
    // Calculate position with viewport boundaries
    const menuWidth = 192 // w-48 = 12rem = 192px
    const menuHeight = items.length * 40 + 8 // Approximate height per item + padding
    
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    // Adjust position if menu would go off-screen
    let adjustedX = x + 8 // Small offset from cursor
    let adjustedY = y + 8
    
    if (adjustedX + menuWidth > viewportWidth) {
      adjustedX = x - menuWidth - 8 // Show to the left of cursor
    }
    
    if (adjustedY + menuHeight > viewportHeight) {
      adjustedY = y - menuHeight - 8 // Show above cursor
    }
    
    // Ensure menu doesn't go off the left or top edges
    adjustedX = Math.max(8, adjustedX)
    adjustedY = Math.max(8, adjustedY)

    setContextMenu({
      visible: true,
      x: adjustedX,
      y: adjustedY,
      items
    })
  }, [])

  const hideContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }))
  }, [])

  // Global event handlers for dismissing context menu
  useEffect(() => {
    if (!contextMenu.visible) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // Only close if clicking outside the context menu
      if (!target.closest('.context-menu')) {
        hideContextMenu()
      }
    }

    const handleContextMenuOutside = (event: MouseEvent) => {
      event.preventDefault()
      const target = event.target as Element
      // Only close if right-clicking outside the context menu
      if (!target.closest('.context-menu')) {
        hideContextMenu()
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideContextMenu()
      }
    }

    // Add a small delay to prevent immediate closing from the same click event
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, { capture: true })
      document.addEventListener('contextmenu', handleContextMenuOutside, { capture: true })
      document.addEventListener('keydown', handleEscapeKey)
    }, 50)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('click', handleClickOutside, { capture: true })
      document.removeEventListener('contextmenu', handleContextMenuOutside, { capture: true })
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [contextMenu.visible, hideContextMenu])

  const value: ContextMenuContextType = {
    contextMenu,
    showContextMenu,
    hideContextMenu
  }

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      
      {/* Global Context Menu Render */}
      {contextMenu.visible && (
        <div 
          className="context-menu fixed w-48 bg-popover border rounded-md shadow-lg z-[9999] pointer-events-auto"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onMouseLeave={(e) => {
            // Prevent menu from closing when mouse briefly leaves
            e.stopPropagation()
          }}
        >
          <div className="py-1">
            {contextMenu.items.map((item) => (
              <button
                key={item.id}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2 ${
                  item.variant === 'destructive' ? 'text-destructive' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  item.onClick()
                  hideContextMenu()
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </ContextMenuContext.Provider>
  )
}