import { useEffect, useRef } from 'react'
import { Toaster } from 'sonner'
import { useTheme } from '@/hooks/use-theme'
import { useUpdater } from '@/hooks/useUpdater'
import { useGetAppSettings } from '@/hooks/useSettings'
import { useNxmDeepLink, syncNexusApiKeyFromPreferences } from '@/hooks/useNexusMods'
import { useCostumeAutoSync } from '@/hooks/useMods'
import { usePreferences } from '@/services/preferences'
import { ModManager } from '../ModManager'
import { PreferencesDialog } from '../preferences/PreferencesDialog'
import { NexusDownloadModal } from '../NexusDownloadModal'

export function MainWindow() {
  const { theme } = useTheme()
  const { checkForUpdates } = useUpdater()
  const { data: settings } = useGetAppSettings()
  const hasCheckedForUpdates = useRef(false)

  // Sync Nexus API key from backend preferences to localStorage
  const { data: preferences } = usePreferences()
  useEffect(() => {
    if (preferences?.nexusApiKey) {
      syncNexusApiKeyFromPreferences(preferences.nexusApiKey)
    }
  }, [preferences?.nexusApiKey])

  // Listen for NXM deep links (Nexus Mods "Download with Manager")
  const { downloadStatus, downloadModName, downloadProgress, downloadError, dismissDownload } = useNxmDeepLink()

  // Pull newly released costumes/icons from GitHub on startup
  useCostumeAutoSync()

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

      {/* Nexus Mods Download Modal */}
      <NexusDownloadModal
        status={downloadStatus}
        modName={downloadModName}
        progress={downloadProgress}
        error={downloadError}
        onDismiss={dismissDownload}
      />

      {/* Toast Notifications — warm-dark editorial style */}
      <Toaster
        position="bottom-right"
        theme={theme.includes('light') ? 'light' : 'dark'}
        gap={10}
        visibleToasts={4}
        expand
        toastOptions={{
          classNames: {
            toast: 'rivals-toast',
            title: 'rivals-toast-title',
            description: 'rivals-toast-desc',
            icon: 'rivals-toast-icon',
            actionButton: 'rivals-toast-action',
            cancelButton: 'rivals-toast-cancel',
            success: 'rivals-toast-success',
            error: 'rivals-toast-error',
            info: 'rivals-toast-info',
            warning: 'rivals-toast-warning',
          },
        }}
      />
    </div>
  )
}

export default MainWindow
