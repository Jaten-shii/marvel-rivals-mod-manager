import { useState, useCallback } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';
import { APP_VERSION } from '../shared/constants';
import { useUIStore, type UpdateInfo } from '../stores/useUIStore';

// Module-level variable to store the update handle
// This persists across all hook instances and component remounts
let updateHandle: Update | null = null;

interface UseUpdaterReturn {
  isChecking: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  availableUpdate: UpdateInfo | null;
  currentVersion: string;
  checkForUpdates: (silent?: boolean) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  restartApp: () => Promise<void>;
}

export function useUpdater(): UseUpdaterReturn {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Use shared state from Zustand store instead of local useState
  const availableUpdate = useUIStore((state) => state.availableUpdate);
  const setAvailableUpdate = useUIStore((state) => state.setAvailableUpdate);

  // Get current version from constants
  const currentVersion = APP_VERSION;

  const checkForUpdates = useCallback(async (silent = false) => {
    console.log('[Updater] checkForUpdates called - silent:', silent);
    setIsChecking(true);
    setAvailableUpdate(null);

    try {
      console.log('[Updater] Checking for updates from Tauri plugin...');
      const update = await check();
      console.log('[Updater] Check response:', update);

      if (update?.available) {
        console.log('[Updater] ✅ Update available:', update.version);
        console.log('[Updater] Setting availableUpdate in Zustand store...');
        updateHandle = update;
        const updateInfo = {
          version: update.version,
          date: update.date || new Date().toISOString(),
          body: update.body || null,
        };
        setAvailableUpdate(updateInfo);
        console.log('[Updater] Update state set:', updateInfo);
        console.log('[Updater] Showing update toast notification...');
        toast.success(`Update available: v${update.version}`, {
          description: 'Click "Check for Updates" in the sidebar to install',
          duration: 5000,
        });
      } else {
        console.log('[Updater] ℹ️ No updates available - running latest version');
        // Only show "latest version" toast when manually checking (not silent)
        if (!silent) {
          toast.info('You are running the latest version', {
            description: `Current version: v${currentVersion}`,
          });
        }
      }
    } catch (error) {
      console.error('[Updater] ❌ Failed to check for updates:', error);
      // Only show error toast when manually checking (not silent)
      if (!silent) {
        toast.error('Failed to check for updates', {
          description: String(error),
        });
      }
    } finally {
      setIsChecking(false);
      console.log('[Updater] checkForUpdates completed');
    }
  }, [currentVersion, setAvailableUpdate]);

  const downloadAndInstall = useCallback(async () => {
    if (!updateHandle) {
      console.log('[Updater] No update handle available, re-checking for updates...');
      // Try to re-check for updates if handle is missing
      try {
        const update = await check();
        if (update?.available) {
          updateHandle = update;
        } else {
          toast.error('No update available to install');
          return;
        }
      } catch {
        toast.error('No update available to install');
        return;
      }
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      console.log('[Updater] Downloading update...');

      // Download and install with progress tracking
      await updateHandle.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            console.log('[Updater] Download started');
            toast.info('Downloading update...');
            setDownloadProgress(0);
            break;
          case 'Progress':
            // Tauri v2 doesn't provide total size, so we'll show incremental progress
            // Just increment progress to show activity
            setDownloadProgress((prev) => Math.min(prev + 5, 95));
            console.log(`[Updater] Download progress: ${event.data.chunkLength} bytes received`);
            break;
          case 'Finished':
            console.log('[Updater] Download and install complete');
            setDownloadProgress(100);
            toast.success('Update installed successfully!', {
              description: 'Restart the app to apply the update',
            });
            break;
        }
      });

      setIsDownloading(false);
      setDownloadProgress(100);
    } catch (error) {
      console.error('[Updater] Failed to download/install update:', error);
      toast.error('Failed to install update', {
        description: String(error),
      });
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, []);

  const restartApp = useCallback(async () => {
    try {
      console.log('[Updater] Restarting application...');
      await relaunch();
    } catch (error) {
      console.error('[Updater] Failed to restart:', error);
      toast.error('Failed to restart app', {
        description: 'Please manually restart the application',
      });
    }
  }, []);

  return {
    isChecking,
    isDownloading,
    downloadProgress,
    availableUpdate,
    currentVersion,
    checkForUpdates,
    downloadAndInstall,
    restartApp,
  };
}
