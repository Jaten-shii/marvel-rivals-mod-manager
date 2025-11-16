import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '../types/mod.types';

// ===== Query Keys =====
export const settingsKeys = {
  all: ['settings'] as const,
  app: () => [...settingsKeys.all, 'app'] as const,
};

// ===== Queries =====

/**
 * Get app settings
 */
export function useGetAppSettings() {
  return useQuery({
    queryKey: settingsKeys.app(),
    queryFn: async () => {
      const settings = await invoke<AppSettings>('get_app_settings');
      return settings;
    },
    staleTime: Infinity, // Settings don't change often
  });
}

// ===== Mutations =====

/**
 * Save app settings
 */
export function useSaveAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: AppSettings) => {
      await invoke('save_app_settings', { settings });
    },
    onSuccess: (_, settings) => {
      // Update the cache with new settings
      queryClient.setQueryData(settingsKeys.app(), settings);
    },
  });
}
