import { useEffect, useRef } from 'react'
import { Toaster } from 'sonner'
import { useTheme } from '@/hooks/use-theme'
import { useUpdater } from '@/hooks/useUpdater'
import { useGetAppSettings } from '@/hooks/useSettings'
import { ModManager } from '../ModManager'
import { PreferencesDialog } from '../preferences/PreferencesDialog'

export function MainWindow() {
  const { theme } = useTheme()
  const { checkForUpdates } = useUpdater()
  const { data: settings } = useGetAppSettings()
  const hasCheckedForUpdates = useRef(false)

  // Check for updates on startup if enabled in settings (only once per app session)
  useEffect(() => {
    if (settings?.autoCheckUpdates && !hasCheckedForUpdates.current) {
      hasCheckedForUpdates.current = true

      // Check for updates 5 seconds after app loads (silent mode - no toast on "latest version")
      const timer = setTimeout(() => {
        checkForUpdates(true)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [settings?.autoCheckUpdates, checkForUpdates])

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Marvel Rivals Mod Manager */}
      <ModManager />

      {/* Settings Dialog */}
      <PreferencesDialog />

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        theme={
          theme.includes('light') ? 'light' : 'dark'
        }
        className="toaster group"
        toastOptions={{
          classNames: {
            toast:
              'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
            description: 'group-[.toast]:text-muted-foreground',
            actionButton:
              'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton:
              'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          },
        }}
      />
    </div>
  )
}

export default MainWindow
