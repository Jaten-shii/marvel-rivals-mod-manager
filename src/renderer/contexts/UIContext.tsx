import { createContext, useContext, useState, useCallback } from 'react'
import type { ViewMode, Theme } from 'shared/types'

interface Dialog {
  id: string
  type: 'confirm' | 'error' | 'info' | 'warning'
  title: string
  message: string
  onConfirm?: () => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
}

interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface UIContextState {
  // View State
  viewMode: ViewMode
  theme: Theme
  
  // Panel States
  isDetailsPanelVisible: boolean
  isSettingsOpen: boolean
  isSidebarCollapsed: boolean
  
  // Dialog State
  dialogs: Dialog[]
  
  // Notification State
  notifications: Notification[]
  
  // Loading States
  isInstalling: boolean
  isDragOver: boolean
  
  // Search State
  searchFocused: boolean
}

interface UIContextActions {
  // View Management
  setViewMode: (mode: ViewMode) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  
  // Panel Management
  showDetailsPanel: () => void
  hideDetailsPanel: () => void
  toggleDetailsPanel: () => void
  openSettings: () => void
  closeSettings: () => void
  toggleSidebar: () => void
  
  // Dialog Management
  showDialog: (dialog: Omit<Dialog, 'id'>) => string
  closeDialog: (id: string) => void
  closeAllDialogs: () => void
  
  // Notification Management
  showNotification: (notification: Omit<Notification, 'id'>) => string
  dismissNotification: (id: string) => void
  clearAllNotifications: () => void
  
  // Drag & Drop
  setDragOver: (isDragOver: boolean) => void
  
  // Loading States
  setInstalling: (isInstalling: boolean) => void
  
  // Search
  setSearchFocused: (focused: boolean) => void
}

type UIContextValue = UIContextState & UIContextActions

const UIContext = createContext<UIContextValue | null>(null)

export function useUIContext() {
  const context = useContext(UIContext)
  if (!context) {
    throw new Error('useUIContext must be used within a UIProvider')
  }
  return context
}

interface UIProviderProps {
  children: React.ReactNode
}

export function UIProvider({ children }: UIProviderProps) {
  // View State
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [theme, setTheme] = useState<Theme>('dark')
  
  // Panel States
  const [isDetailsPanelVisible, setIsDetailsPanelVisible] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  
  // Dialog State
  const [dialogs, setDialogs] = useState<Dialog[]>([])
  
  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([])
  
  // Loading States
  const [isInstalling, setInstalling] = useState(false)
  const [isDragOver, setDragOver] = useState(false)
  
  // Search State
  const [searchFocused, setSearchFocused] = useState(false)

  // Theme Management
  const toggleTheme = useCallback(() => {
    const themes: Theme[] = ['dark', 'light', 'glass']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }, [theme])

  // Panel Management
  const showDetailsPanel = useCallback(() => {
    setIsDetailsPanelVisible(true)
  }, [])

  const hideDetailsPanel = useCallback(() => {
    setIsDetailsPanelVisible(false)
  }, [])

  const toggleDetailsPanel = useCallback(() => {
    setIsDetailsPanelVisible(prev => !prev)
  }, [])

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev)
  }, [])

  // Dialog Management
  const showDialog = useCallback((dialog: Omit<Dialog, 'id'>): string => {
    const id = `dialog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newDialog: Dialog = { ...dialog, id }
    
    setDialogs(prev => [...prev, newDialog])
    return id
  }, [])

  const closeDialog = useCallback((id: string) => {
    setDialogs(prev => prev.filter(dialog => dialog.id !== id))
  }, [])

  const closeAllDialogs = useCallback(() => {
    setDialogs([])
  }, [])

  // Notification Management
  const showNotification = useCallback((notification: Omit<Notification, 'id'>): string => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newNotification: Notification = { ...notification, id }
    
    setNotifications(prev => [...prev, newNotification])
    
    // Auto-dismiss after duration (default 5 seconds)
    const duration = notification.duration ?? 5000
    if (duration > 0) {
      setTimeout(() => {
        dismissNotification(id)
      }, duration)
    }
    
    return id
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const contextValue: UIContextValue = {
    // State
    viewMode,
    theme,
    isDetailsPanelVisible,
    isSettingsOpen,
    isSidebarCollapsed,
    dialogs,
    notifications,
    isInstalling,
    isDragOver,
    searchFocused,
    
    // Actions
    setViewMode,
    setTheme,
    toggleTheme,
    showDetailsPanel,
    hideDetailsPanel,
    toggleDetailsPanel,
    openSettings,
    closeSettings,
    toggleSidebar,
    showDialog,
    closeDialog,
    closeAllDialogs,
    showNotification,
    dismissNotification,
    clearAllNotifications,
    setDragOver,
    setInstalling,
    setSearchFocused,
  }

  return (
    <UIContext.Provider value={contextValue}>
      {children}
    </UIContext.Provider>
  )
}