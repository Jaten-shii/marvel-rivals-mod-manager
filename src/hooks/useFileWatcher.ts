import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { modKeys } from './useMods';

/**
 * Hook to manage file watching for the mods directory
 */
export function useFileWatcher(modsDirectory: string | null, enabled: boolean = true) {
  const queryClient = useQueryClient();

  const startWatcher = useCallback(async () => {
    if (!modsDirectory || !enabled) return;

    try {
      await invoke('start_file_watcher', { modsDirectory });
      console.log('File watcher started for:', modsDirectory);
    } catch (error) {
      console.error('Failed to start file watcher:', error);
    }
  }, [modsDirectory, enabled]);

  const stopWatcher = useCallback(async () => {
    try {
      await invoke('stop_file_watcher');
      console.log('File watcher stopped');
    } catch (error) {
      console.error('Failed to stop file watcher:', error);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Start file watcher
    startWatcher();

    // Listen for file system changes
    const unlisten = listen('mods-directory-changed', () => {
      console.log('Mods directory changed, refetching...');
      // Invalidate mods list to trigger refetch
      queryClient.invalidateQueries({ queryKey: modKeys.lists() });
      queryClient.invalidateQueries({ queryKey: modKeys.stats() });
    });

    // Cleanup
    return () => {
      stopWatcher();
      unlisten.then((fn) => fn());
    };
  }, [modsDirectory, enabled, startWatcher, stopWatcher, queryClient]);

  return { startWatcher, stopWatcher };
}
