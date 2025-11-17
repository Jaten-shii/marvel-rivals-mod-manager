import { useState } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';
import { APP_VERSION } from '../shared/constants';

interface UpdateInfo {
  version: string;
  date: string;
  body: string | null;
}

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
  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null);
  const [updateHandle, setUpdateHandle] = useState<Update | null>(null);

  // Get current version from constants
  const currentVersion = APP_VERSION;

  const checkForUpdates = async (silent = false) => {
    setIsChecking(true);
    setAvailableUpdate(null);

    try {
      console.log('[Updater] Checking for updates...');
      const update = await check();

      if (update?.available) {
        console.log('[Updater] Update available:', update.version);
        setUpdateHandle(update);
        setAvailableUpdate({
          version: update.version,
          date: update.date || new Date().toISOString(),
          body: update.body || null,
        });
        toast.success(`Update available: v${update.version}`, {
          description: 'Click "Check for Updates" in the sidebar to install',
          duration: 5000,
        });
      } else {
        console.log('[Updater] No updates available');
        // Only show "latest version" toast when manually checking (not silent)
        if (!silent) {
          toast.info('You are running the latest version', {
            description: `Current version: v${currentVersion}`,
          });
        }
      }
    } catch (error) {
      console.error('[Updater] Failed to check for updates:', error);
      // Only show error toast when manually checking (not silent)
      if (!silent) {
        toast.error('Failed to check for updates', {
          description: String(error),
        });
      }
    } finally {
      setIsChecking(false);
    }
  };

  const downloadAndInstall = async () => {
    if (!updateHandle) {
      toast.error('No update available to install');
      return;
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
  };

  const restartApp = async () => {
    try {
      console.log('[Updater] Restarting application...');
      await relaunch();
    } catch (error) {
      console.error('[Updater] Failed to restart:', error);
      toast.error('Failed to restart app', {
        description: 'Please manually restart the application',
      });
    }
  };

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
