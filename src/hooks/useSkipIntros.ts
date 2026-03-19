import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';

interface SkipIntrosStatus {
  installed: boolean;
  hasBackup: boolean;
}

export function useSkipIntros() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['skipIntros', 'status'],
    queryFn: () => invoke<SkipIntrosStatus>('get_skip_intros_status'),
    retry: false,
    // Don't refetch on window focus for this query
    refetchOnWindowFocus: false,
  });

  const installMutation = useMutation({
    mutationFn: async () => {
      const file = await open({
        title: 'Select Skip Intros Mod ZIP',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      });
      if (!file) {
        throw new Error('No file selected');
      }
      return invoke('install_skip_intros', { zipPath: file });
    },
    onSuccess: () => {
      toast.success('Skip Intros mod installed successfully', {
        description: 'Game intro videos will now be skipped',
      });
      queryClient.invalidateQueries({ queryKey: ['skipIntros'] });
    },
    onError: (error) => {
      toast.error('Failed to install Skip Intros mod', {
        description: String(error),
      });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: () => invoke('uninstall_skip_intros'),
    onSuccess: () => {
      toast.success('Skip Intros mod uninstalled', {
        description: 'Original intro videos have been restored',
      });
      queryClient.invalidateQueries({ queryKey: ['skipIntros'] });
    },
    onError: (error) => {
      toast.error('Failed to uninstall Skip Intros mod', {
        description: String(error),
      });
    },
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    isError: statusQuery.isError,
    error: statusQuery.error,
    install: installMutation.mutate,
    uninstall: uninstallMutation.mutate,
    isInstalling: installMutation.isPending,
    isUninstalling: uninstallMutation.isPending,
  };
}
