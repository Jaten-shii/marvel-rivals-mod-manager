import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import type { ModInfo, ModMetadata, Costume, Character } from '@/types/mod.types'
import { toast } from 'sonner'

// Query keys factory
export const modKeys = {
  all: ['mods'] as const,
  lists: () => [...modKeys.all, 'list'] as const,
  list: (filters?: any) => [...modKeys.lists(), { filters }] as const,
  details: () => [...modKeys.all, 'detail'] as const,
  detail: (id: string) => [...modKeys.details(), id] as const,
  stats: () => [...modKeys.all, 'stats'] as const,
}

// Query keys
const MODS_QUERY_KEY = modKeys.lists()

/**
 * Hook to get all mods
 */
export function useGetMods() {
  return useQuery({
    queryKey: MODS_QUERY_KEY,
    queryFn: async () => {
      try {
        console.log('[useMods] Fetching mods...')
        const mods = await invoke<ModInfo[]>('get_all_mods')
        console.log('[useMods] Loaded mods:', mods.length, mods)
        return mods
      } catch (error) {
        console.error('[useMods] Error loading mods:', error)
        throw error
      }
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchOnWindowFocus: true,
    retry: false, // Don't retry on error for easier debugging
  })
}

/**
 * Hook to install a mod
 */
export function useInstallMod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (filePath: string) => {
      console.log('[useMods] Installing mod from:', filePath)
      return await invoke<ModInfo>('install_mod', { filePath })
    },
    onSuccess: (newMod) => {
      console.log('[useMods] Mod installed successfully:', newMod.name)

      // Optimistic update: add new mod to existing list instead of invalidating
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        // Add new mod to the beginning of the list
        return [newMod, ...oldMods]
      })

      toast.success(`Mod "${newMod.name}" installed successfully`)
    },
    onError: (error: Error) => {
      console.error('[useMods] Failed to install mod:', error)
      toast.error(`Failed to install mod: ${error.message}`)
    },
  })
}

/**
 * Hook to enable/disable a mod
 */
export function useToggleMod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ modId, enabled }: { modId: string; enabled: boolean }) => {
      console.log('[useMods] Toggling mod:', modId, enabled)

      // Check if game is running
      const isGameRunning = await checkGameRunning()
      if (isGameRunning) {
        throw new Error('Cannot enable/disable mods while Marvel Rivals is running. Please close the game first.')
      }

      await invoke('enable_mod', { modId, enabled })
      return { modId, enabled }
    },
    onSuccess: (data) => {
      const action = data.enabled ? 'enabled' : 'disabled'
      console.log('[useMods] Mod', action, 'successfully')

      // Optimistic update: update specific mod instead of invalidating all
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        return oldMods.map(mod =>
          mod.id === data.modId ? { ...mod, enabled: data.enabled } : mod
        )
      })

      toast.success(`Mod ${action} successfully`)
    },
    onError: (error: Error) => {
      console.error('[useMods] Failed to toggle mod:', error)
      toast.error(error.message)
    },
  })
}

/**
 * Hook to check if the game is running
 */
async function checkGameRunning(): Promise<boolean> {
  try {
    const isRunning = await invoke<boolean>('is_game_running')
    return isRunning
  } catch (error) {
    console.error('[useMods] Failed to check game status:', error)
    return false
  }
}

/**
 * Hook to delete a mod
 */
export function useDeleteMod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (modId: string) => {
      console.log('[useMods] Deleting mod:', modId)

      // Check if game is running
      const isGameRunning = await checkGameRunning()
      if (isGameRunning) {
        throw new Error('Cannot delete mods while Marvel Rivals is running. Please close the game first.')
      }

      await invoke('delete_mod', { modId })
      return modId
    },
    onSuccess: (modId) => {
      console.log('[useMods] Mod deleted successfully')

      // Optimistic update: remove mod from list
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        return oldMods.filter(mod => mod.id !== modId)
      })

      toast.success('Mod deleted successfully')
    },
    onError: (error: Error) => {
      console.error('[useMods] Failed to delete mod:', error)
      toast.error(error.message)
    },
  })
}

/**
 * Hook to toggle mod enabled/disabled state
 * Moves mod files between active and disabled directories
 */
export function useToggleModEnabled() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (modId: string) => {
      console.log('[useMods] Toggling mod enabled state:', modId)

      // Check if game is running
      const isGameRunning = await checkGameRunning()
      if (isGameRunning) {
        throw new Error('Cannot enable/disable mods while Marvel Rivals is running. Please close the game first.')
      }

      // Get current mod state
      const mods = queryClient.getQueryData<ModInfo[]>(MODS_QUERY_KEY)
      const mod = mods?.find((m) => m.id === modId)

      if (!mod) {
        throw new Error('Mod not found')
      }

      const newEnabledState = !mod.enabled

      // Toggle enabled state
      await invoke('enable_mod', { modId, enabled: newEnabledState })

      return { modId, enabled: newEnabledState }
    },
    onSuccess: (data) => {
      console.log('[useMods] Mod enabled state toggled successfully')

      // Optimistic update: update specific mod
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        return oldMods.map(mod =>
          mod.id === data.modId ? { ...mod, enabled: data.enabled } : mod
        )
      })

      toast.success('Mod status updated')
    },
    onError: (error: Error) => {
      console.error('[useMods] Failed to toggle mod:', error)
      toast.error(error.message)
    },
  })
}

/**
 * Hook to toggle mod favorite status
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (modId: string) => {
      console.log('[useMods] Toggling mod favorite:', modId)

      // Get current mod to toggle favorite
      const mods = queryClient.getQueryData<ModInfo[]>(MODS_QUERY_KEY)
      const mod = mods?.find((m) => m.id === modId)

      if (!mod) {
        throw new Error('Mod not found')
      }

      // Toggle favorite and update metadata
      const updatedMetadata: ModMetadata = {
        ...mod.metadata,
        isFavorite: !mod.isFavorite,
      }

      return await invoke<ModInfo>('update_mod_metadata', { modId, metadata: updatedMetadata })
    },
    onSuccess: (updatedMod) => {
      const action = updatedMod.isFavorite ? 'added to' : 'removed from'
      console.log(`[useMods] Mod ${action} favorites successfully`)

      // Optimistic update: update specific mod
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        return oldMods.map(mod =>
          mod.id === updatedMod.id ? updatedMod : mod
        )
      })

      toast.success(`Mod ${action} favorites`)
    },
    onError: (error: Error) => {
      console.error('[useMods] Failed to toggle favorite:', error)
      toast.error(`Failed to toggle favorite: ${error.message}`)
    },
  })
}

/**
 * Hook to update mod metadata
 */
export function useUpdateModMetadata() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ modId, metadata }: { modId: string; metadata: ModMetadata }) => {
      console.log('[useMods] Updating mod metadata:', modId)
      return await invoke<ModInfo>('update_mod_metadata', { modId, metadata })
    },
    onSuccess: (updatedMod) => {
      console.log('[useMods] Metadata updated successfully:', updatedMod.name)

      // Optimistic update: update specific mod
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        return oldMods.map(mod =>
          mod.id === updatedMod.id ? updatedMod : mod
        )
      })

      toast.success('Mod metadata updated successfully')
    },
    onError: (error: Error) => {
      console.error('[useMods] Failed to update metadata:', error)
      toast.error(`Failed to update metadata: ${error.message}`)
    },
  })
}

/**
 * Hook to remove a profile from all mods
 */
export function useRemoveProfileFromAllMods() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (profileId: string) => {
      console.log('[useMods] Removing profile from all mods:', profileId)
      return await invoke<number>('remove_profile_from_all_mods', { profileId })
    },
    onSuccess: (count) => {
      console.log('[useMods] Profile removed from', count, 'mods')
      queryClient.invalidateQueries({ queryKey: MODS_QUERY_KEY })
    },
    onError: (error: Error) => {
      console.error('[useMods] Failed to remove profile:', error)
      toast.error(`Failed to remove profile: ${error.message}`)
    },
  })
}

/**
 * Hook to get costumes for a specific character
 */
export function useGetCostumesForCharacter(character: Character | null) {
  return useQuery({
    queryKey: ['costumes', character],
    queryFn: async () => {
      if (!character) return []
      console.log('[useMods] Fetching costumes for character:', character)
      const costumes = await invoke<Costume[]>('get_costumes_for_character', { character })
      console.log('[useMods] Loaded costumes:', costumes.length)
      return costumes
    },
    enabled: !!character, // Only run query if character is selected
    staleTime: 300000, // Cache for 5 minutes (costume data rarely changes)
  })
}

/**
 * Hook to get all costumes (for caching on app startup)
 */
export function useGetAllCostumes() {
  return useQuery({
    queryKey: ['costumes', 'all'],
    queryFn: async () => {
      console.log('[useMods] Fetching all costumes')
      const costumes = await invoke<Record<string, Costume[]>>('get_all_costumes')
      console.log('[useMods] Loaded all costumes')
      return costumes
    },
    staleTime: 300000, // Cache for 5 minutes
  })
}
