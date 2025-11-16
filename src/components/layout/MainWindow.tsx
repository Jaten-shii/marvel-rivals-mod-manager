import { Toaster } from 'sonner'
import { useTheme } from '@/hooks/use-theme'
import { ModManager } from '../ModManager'
import { PreferencesDialog } from '../preferences/PreferencesDialog'

export function MainWindow() {
  const { theme } = useTheme()

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
