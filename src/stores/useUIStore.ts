import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ViewMode, ThemeMode, ModFilters } from '../types/mod.types';
import type { Profile } from '../shared/profiles';

export type SortOption = 'date' | 'category' | 'character' | 'name' | 'updated' | 'profile';

interface UIStore {
  // Theme
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // Sidebars
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;

  // View Mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Sorting
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;

  // NSFW Preference (persisted)
  nsfwEnabled: boolean;
  setNsfwEnabled: (enabled: boolean) => void;

  // Selected Mod
  selectedModId: string | null;
  setSelectedModId: (id: string | null) => void;

  // Filters
  filters: ModFilters;
  setFilters: (filters: Partial<ModFilters>) => void;
  resetFilters: () => void;

  // Dialogs
  preferencesOpen: boolean;
  setPreferencesOpen: (open: boolean) => void;
  metadataDialogOpen: boolean;
  metadataDialogModId: string | null;
  setMetadataDialogOpen: (open: boolean, modId?: string | null) => void;
  changelogDialogOpen: boolean;
  setChangelogDialogOpen: (open: boolean) => void;
  updateDialogOpen: boolean;
  setUpdateDialogOpen: (open: boolean) => void;

  // Profiles
  profiles: Profile[];
  activeProfileFilter: string | null;
  setActiveProfileFilter: (profileId: string | null) => void;
  addProfile: (profile: Profile) => void;
  updateProfile: (profileId: string, updates: Partial<Profile>) => void;
  deleteProfile: (profileId: string) => void;

  // Profile Dialog
  profileDialogOpen: boolean;
  profileDialogMode: 'create' | 'edit' | null;
  profileDialogProfileId: string | null;
  setProfileDialogOpen: (open: boolean, mode?: 'create' | 'edit', profileId?: string | null) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Theme
      theme: 'dark-classic',
      setTheme: (theme) => set({ theme }),

      // Sidebars
      leftSidebarOpen: true,
      rightSidebarOpen: false,
      toggleLeftSidebar: () =>
        set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
      toggleRightSidebar: () =>
        set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
      setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
      setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),

      // View Mode
      viewMode: 'grid',
      setViewMode: (mode) => set({ viewMode: mode }),

      // Sorting
      sortBy: 'date',
      setSortBy: (sort) => set({ sortBy: sort }),

      // NSFW Preference
      nsfwEnabled: false, // Hide NSFW by default
      setNsfwEnabled: (enabled) => set((state) => ({
        nsfwEnabled: enabled,
        filters: { ...state.filters, showNsfw: enabled }
      })),

      // Selected Mod
      selectedModId: null,
      setSelectedModId: (id) => set({ selectedModId: id }),

      // Filters
      filters: {
        search: '',
        category: null,
        character: null,
        showEnabled: true,
        showDisabled: true,
        showFavorites: false,
        showNsfw: false, // Will be set from nsfwEnabled on load
      },
      setFilters: (newFilters) =>
        set((state) => {
          // If showNsfw is being changed, update the persisted preference too
          if (newFilters.showNsfw !== undefined) {
            return {
              filters: { ...state.filters, ...newFilters },
              nsfwEnabled: newFilters.showNsfw
            };
          }
          return {
            filters: { ...state.filters, ...newFilters },
          };
        }),
      resetFilters: () => set((state) => ({
        filters: {
          search: '',
          category: null,
          character: null,
          showEnabled: true,
          showDisabled: true,
          showFavorites: false,
          showNsfw: state.nsfwEnabled, // Preserve NSFW preference
        }
      })),

      // Dialogs
      preferencesOpen: false,
      setPreferencesOpen: (open) => set({ preferencesOpen: open }),
      metadataDialogOpen: false,
      metadataDialogModId: null,
      setMetadataDialogOpen: (open, modId = null) =>
        set({ metadataDialogOpen: open, metadataDialogModId: modId }),
      changelogDialogOpen: false,
      setChangelogDialogOpen: (open) => set({ changelogDialogOpen: open }),
      updateDialogOpen: false,
      setUpdateDialogOpen: (open) => set({ updateDialogOpen: open }),

      // Profiles
      profiles: [],
      activeProfileFilter: null,
      setActiveProfileFilter: (profileId) => set({ activeProfileFilter: profileId }),
      addProfile: (profile) =>
        set((state) => ({ profiles: [...state.profiles, profile] })),
      updateProfile: (profileId, updates) =>
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === profileId ? { ...p, ...updates } : p
          ),
        })),
      deleteProfile: (profileId) =>
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== profileId),
          // Clear filter if deleting the active profile
          activeProfileFilter:
            state.activeProfileFilter === profileId ? null : state.activeProfileFilter,
        })),

      // Profile Dialog
      profileDialogOpen: false,
      profileDialogMode: null,
      profileDialogProfileId: null,
      setProfileDialogOpen: (open, mode = undefined, profileId = null) =>
        set({
          profileDialogOpen: open,
          profileDialogMode: mode,
          profileDialogProfileId: profileId,
        }),
    }),
    {
      name: 'marvel-rivals-ui-storage', // localStorage key
      partialize: (state) => ({
        theme: state.theme,
        viewMode: state.viewMode,
        leftSidebarOpen: state.leftSidebarOpen,
        sortBy: state.sortBy,
        nsfwEnabled: state.nsfwEnabled,
        profiles: state.profiles,
        // Don't persist filters, selectedModId, rightSidebarOpen, dialogs, or activeProfileFilter
      }),
      onRehydrateStorage: () => (state) => {
        // Apply the persisted nsfwEnabled to filters on load
        if (state) {
          state.filters.showNsfw = state.nsfwEnabled;
        }
      },
    }
  )
);
