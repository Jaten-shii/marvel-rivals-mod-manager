import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { modKeys } from './useMods'

/**
 * Hook to migrate data from old Electron app
 */
export function useMigrateElectronData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      console.log('[useMigration] Starting migration from Electron app...')
      const result = await invoke<[number, number]>('migrate_electron_data')
      return result
    },
    onSuccess: ([metadataCount, thumbnailCount]) => {
      console.log('[useMigration] Migration successful:', { metadataCount, thumbnailCount })
      
      // Invalidate mods query to reload with new metadata
      queryClient.invalidateQueries({ queryKey: modKeys.lists() })
      
      toast.success(
        `Migration complete! Imported ${metadataCount} metadata files and ${thumbnailCount} thumbnails`
      )
    },
    onError: (error: Error) => {
      console.error('[useMigration] Migration failed:', error)
      
      if (error.message.includes('not found')) {
        toast.error('No old Electron app data found to migrate')
      } else {
        toast.error(`Migration failed: ${error.message}`)
      }
    },
  })
}
