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
      const mods = await invoke<ModInfo[]>('get_all_mods')
      return mods
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

/**
 * Hook to install a mod
 */
export function useInstallMod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (filePath: string) => {
      return await invoke<ModInfo>('install_mod', { filePath })
    },
    onSuccess: (newMod) => {
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        return [newMod, ...oldMods]
      })
      toast.success(`Mod "${newMod.name}" installed successfully`)
    },
    onError: (error: Error) => {
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
      const isGameRunning = await checkGameRunning()
      if (isGameRunning) {
        throw new Error('Cannot enable/disable mods while Marvel Rivals is running. Please close the game first.')
      }

      await invoke('enable_mod', { modId, enabled })
      return { modId, enabled }
    },
    onSuccess: (data) => {
      const action = data.enabled ? 'enabled' : 'disabled'
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        return oldMods.map(mod =>
          mod.id === data.modId ? { ...mod, enabled: data.enabled } : mod
        )
      })
      toast.success(`Mod ${action} successfully`)
    },
    onError: (error: Error) => {
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
  } catch {
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
      const isGameRunning = await checkGameRunning()
      if (isGameRunning) {
        throw new Error('Cannot delete mods while Marvel Rivals is running. Please close the game first.')
      }

      await invoke('delete_mod', { modId })
      return modId
    },
    onSuccess: (modId) => {
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        return oldMods.filter(mod => mod.id !== modId)
      })
      toast.success('Mod deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

/**
 * Hook to toggle mod enabled/disabled state
 */
export function useToggleModEnabled() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (modId: string) => {
      const isGameRunning = await checkGameRunning()
      if (isGameRunning) {
        throw new Error('Cannot enable/disable mods while Marvel Rivals is running. Please close the game first.')
      }

      const mods = queryClient.getQueryData<ModInfo[]>(MODS_QUERY_KEY)
      const mod = mods?.find((m) => m.id === modId)

      if (!mod) {
        throw new Error('Mod not found')
      }

      const newEnabledState = !mod.enabled
      await invoke('enable_mod', { modId, enabled: newEnabledState })

      return { modId, enabled: newEnabledState }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        return oldMods.map(mod =>
          mod.id === data.modId ? { ...mod, enabled: data.enabled } : mod
        )
      })
      toast.success('Mod status updated')
    },
    onError: (error: Error) => {
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
      const mods = queryClient.getQueryData<ModInfo[]>(MODS_QUERY_KEY)
      const mod = mods?.find((m) => m.id === modId)

      if (!mod) {
        throw new Error('Mod not found')
      }

      const updatedMetadata: ModMetadata = {
        ...mod.metadata,
        isFavorite: !mod.isFavorite,
      }

      return await invoke<ModInfo>('update_mod_metadata', { modId, metadata: updatedMetadata })
    },
    onSuccess: (updatedMod) => {
      const action = updatedMod.isFavorite ? 'added to' : 'removed from'
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        return oldMods.map(mod =>
          mod.id === updatedMod.id ? updatedMod : mod
        )
      })
      toast.success(`Mod ${action} favorites`)
    },
    onError: (error: Error) => {
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
      const updatedMod = await invoke<ModInfo>('update_mod_metadata', { modId, metadata })
      return { oldModId: modId, updatedMod }
    },
    onSuccess: ({ oldModId, updatedMod }) => {
      queryClient.setQueryData<ModInfo[]>(MODS_QUERY_KEY, (oldMods = []) => {
        if (oldModId === updatedMod.id) {
          return oldMods.map(mod =>
            mod.id === updatedMod.id ? updatedMod : mod
          )
        } else {
          return oldMods
            .filter(mod => mod.id !== oldModId)
            .concat(updatedMod)
        }
      })
      toast.success('Mod metadata updated successfully')
    },
    onError: (error: Error) => {
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
      return await invoke<number>('remove_profile_from_all_mods', { profileId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MODS_QUERY_KEY })
    },
    onError: (error: Error) => {
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
      const costumes = await invoke<Costume[]>('get_costumes_for_character', { character })
      return costumes
    },
    enabled: !!character,
    staleTime: 300000,
  })
}

/**
 * Hook to get all costumes (for caching on app startup)
 */
export function useGetAllCostumes() {
  return useQuery({
    queryKey: ['costumes', 'all'],
    queryFn: async () => {
      const costumes = await invoke<Record<string, Costume[]>>('get_all_costumes')
      return costumes
    },
    staleTime: 300000,
  })
}
