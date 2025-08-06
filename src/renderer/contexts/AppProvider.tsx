import { ModProvider } from './ModContext'
import { SettingsProvider } from './SettingsContext'
import { UIProvider } from './UIContext'
import { ContextMenuProvider } from './ContextMenuContext'

interface AppProviderProps {
  children: React.ReactNode
}

/**
 * Root provider component that wraps the entire application
 * Provides all contexts in the correct order for proper functionality
 */
export function AppProvider({ children }: AppProviderProps) {
  return (
    <SettingsProvider>
      <UIProvider>
        <ContextMenuProvider>
          <ModProvider>
            {children}
          </ModProvider>
        </ContextMenuProvider>
      </UIProvider>
    </SettingsProvider>
  )
}