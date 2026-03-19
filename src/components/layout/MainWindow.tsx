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
    console.log('[MainWindow] Auto-update check effect triggered');
    console.log('[MainWindow] settings:', settings);
    console.log('[MainWindow] settings.autoCheckUpdates:', settings?.autoCheckUpdates);
    console.log('[MainWindow] hasCheckedForUpdates:', hasCheckedForUpdates.current);

    if (settings?.autoCheckUpdates && !hasCheckedForUpdates.current) {
      console.log('[MainWindow] ✅ Auto-check enabled - scheduling update check in 5 seconds...');
      hasCheckedForUpdates.current = true

      // Check for updates 5 seconds after app loads (silent mode - no toast on "latest version")
      const timer = setTimeout(() => {
        console.log('[MainWindow] 🚀 Triggering auto-update check now (silent mode)');
        checkForUpdates(true)
      }, 5000)

      return () => {
        console.log('[MainWindow] Clearing auto-update timer');
        clearTimeout(timer);
      }
    } else if (!settings?.autoCheckUpdates) {
      console.log('[MainWindow] ⚠️ Auto-check disabled in settings');
    } else if (hasCheckedForUpdates.current) {
      console.log('[MainWindow] ℹ️ Auto-check already performed this session');
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
        theme={theme.includes('light') ? 'light' : 'dark'}
        gap={8}
        visibleToasts={4}
        expand
        richColors
        toastOptions={{
          className: 'toast-custom',
          classNames: {
            toast:
              'group toast !rounded-xl !border-0 !shadow-[0_8px_30px_rgba(0,0,0,0.3)] !px-4 !py-3.5 !text-sm !min-h-[56px] !backdrop-blur-sm',
            title: '!text-sm !font-semibold',
            description: '!text-xs !opacity-80',
            icon: '!w-5 !h-5',
            actionButton:
              '!rounded-lg !bg-white/20 !text-white !font-medium !text-xs !px-3 !py-1.5 hover:!bg-white/30',
            cancelButton:
              '!rounded-lg !bg-white/10 !text-white/70 !font-medium !text-xs !px-3 !py-1.5 hover:!bg-white/20',
            success:
              '!bg-emerald-500/90 !text-white !border-emerald-400/30',
            error:
              '!bg-red-500/90 !text-white !border-red-400/30',
            info:
              '!bg-blue-500/90 !text-white !border-blue-400/30',
            warning:
              '!bg-amber-500/90 !text-white !border-amber-400/30',
          },
        }}
      />
    </div>
  )
}

export default MainWindow
