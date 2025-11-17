import { useState } from 'react'
import { ChevronDown, Folder, Monitor, Volume2, Shirt, Gamepad2, FolderOpen, Settings, CircleCheck, CircleX, Trash2, Tag, Plus, Star, FolderCog, Info, BookOpen, RefreshCw, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ScrollArea } from './ui/scroll-area'
import { useUIStore } from '@/stores'
import type { ModCategory, Character } from '@/types/mod.types'
import { cn } from '@/lib/utils'
import { useGetMods, useToggleMod, useDeleteMod, useRemoveProfileFromAllMods } from '@/hooks/useMods'
import { openPath } from '@tauri-apps/plugin-opener'
import { toast } from 'sonner'
import { ProfileItem } from './ProfileItem'
import { ProfileDialog } from './ProfileDialog'
import { invoke } from '@tauri-apps/api/core'
import { APP_VERSION } from '@/shared/constants'
import { useUpdater } from '@/hooks/useUpdater'

// All Marvel Rivals characters in alphabetical order
const ALL_CHARACTERS: Character[] = [
  'Adam Warlock',
  'Angela',
  'Black Panther',
  'Black Widow',
  'Blade',
  'Captain America',
  'Cloak and Dagger',
  'Daredevil',
  'Doctor Strange',
  'Emma Frost',
  'Groot',
  'Hawkeye',
  'Hela',
  'Hulk',
  'Human Torch',
  'Invisible Woman',
  'Iron Fist',
  'Iron Man',
  'Jeff the Land Shark',
  'Loki',
  'Luna Snow',
  'Magik',
  'Magneto',
  'Mantis',
  'Mister Fantastic',
  'Moon Knight',
  'Namor',
  'Peni Parker',
  'Phoenix',
  'Psylocke',
  'Rocket Raccoon',
  'Scarlet Witch',
  'Spider-Man',
  'Squirrel Girl',
  'Star-Lord',
  'Storm',
  'The Punisher',
  'The Thing',
  'Thor',
  'Ultron',
  'Venom',
  'Winter Soldier',
  'Wolverine',
]

// Helper function to get character icon path
function getCharacterIconPath(character: string): string {
  // Map character names to their icon filenames
  const iconMap: Record<string, string> = {
    'Adam Warlock': 'Adam.png',
    'Jeff the Land Shark': 'Jeff.png',
    'The Punisher': 'Punisher.png',
    'Mister Fantastic': 'Mr. Fantastic.png',
    'Cloak and Dagger': 'Cloak & Dagger.png',
    'Spider-Man': 'Spider-Man.png',
    'Star-Lord': 'Star-Lord.png',
  };

  // Use mapping if exists, otherwise use character name directly
  const iconFileName = iconMap[character] || `${character}.png`
  return `/assets/character-icons/${iconFileName}`
}

// Helper function to get category icon
function getCategoryIcon(category: ModCategory) {
  switch (category) {
    case 'UI':
      return <Monitor className="h-4 w-4" />
    case 'Audio':
      return <Volume2 className="h-4 w-4" />
    case 'Skins':
      return <Shirt className="h-4 w-4" />
    case 'Gameplay':
      return <Gamepad2 className="h-4 w-4" />
    default:
      return <Folder className="h-4 w-4" />
  }
}

export function Sidebar() {
  const {
    filters,
    setFilters,
    profiles,
    activeProfileFilter,
    setActiveProfileFilter,
    setProfileDialogOpen,
    setChangelogDialogOpen,
    setUpdateDialogOpen,
    deleteProfile,
  } = useUIStore()
  const { data: mods } = useGetMods()
  const toggleMod = useToggleMod()
  const deleteMod = useDeleteMod()
  const removeProfileFromAllMods = useRemoveProfileFromAllMods()

  const [expandedCategories, setExpandedCategories] = useState<Record<ModCategory, boolean>>({
    UI: false,
    Audio: false,
    Skins: false,
    Gameplay: false,
  })
  const [profilesExpanded, setProfilesExpanded] = useState(false)
  const [toolsExpanded, setToolsExpanded] = useState(false)
  const [appVersionExpanded, setAppVersionExpanded] = useState(false)
  const [showBulkProgress, setShowBulkProgress] = useState(false)
  const [bulkOperation, setBulkOperation] = useState<'enable' | 'disable' | 'delete' | 'disableNsfw' | 'disableProfile'>('enable')
  const [bulkProgressCurrent, setBulkProgressCurrent] = useState(0)
  const [bulkProgressTotal, setBulkProgressTotal] = useState(0)

  const { availableUpdate } = useUpdater()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null)

  // Filter mods based on NSFW setting
  const filteredMods = mods?.filter(mod => {
    if (!filters.showNsfw && mod.metadata.isNsfw) {
      return false
    }
    return true
  }) || []

  // Count mods per category (respecting NSFW filter)
  const categoryCounts = filteredMods.reduce((acc, mod) => {
    acc[mod.category] = (acc[mod.category] || 0) + 1
    return acc
  }, {} as Record<ModCategory, number>)

  // Count mods per character per category (respecting NSFW filter)
  const characterCountsByCategory = filteredMods.reduce((acc, mod) => {
    if (mod.character) {
      if (!acc[mod.category]) {
        acc[mod.category] = {} as Record<Character, number>
      }
      acc[mod.category][mod.character] = (acc[mod.category][mod.character] || 0) + 1
    }
    return acc
  }, {} as Record<ModCategory, Record<Character, number>>)

  // Count mods per profile (respecting NSFW filter)
  const profileCounts = profiles.reduce((acc, profile) => {
    const count = filteredMods.filter(mod =>
      mod.metadata.profileIds?.includes(profile.id)
    ).length
    acc[profile.id] = count
    return acc
  }, {} as Record<string, number>)

  // Check if any NSFW mods exist and are currently shown
  const hasNsfwMods = filteredMods.some(mod => mod.metadata.isNsfw)

  // Count favorite mods
  const favoriteMods = filteredMods.filter(mod => mod.isFavorite)
  const favoriteCount = favoriteMods.length

  const selectCategory = (category: ModCategory | null) => {
    // If clicking the already selected category AND no character is selected, toggle the dropdown
    if (filters.category === category && category !== null && !filters.character) {
      setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))
    } else {
      setFilters({ category, character: null, showFavorites: false })
      // Auto-expand the selected category
      if (category) {
        setExpandedCategories(prev => ({ ...prev, [category]: true }))
      }
    }
  }

  const selectCharacter = (character: Character | null, category: ModCategory) => {
    setFilters({ character, category, showFavorites: false })
  }

  const handleOpenModDirectory = async () => {
    try {
      // Get the first mod to determine the mods directory
      if (mods && mods.length > 0) {
        const firstMod = mods[0]
        if (!firstMod) {
          toast.error('Could not locate first mod')
          return
        }
        // Extract the ~mods directory path (not the specific mod subfolder)
        const modsIndex = firstMod.filePath.indexOf('~mods')
        if (modsIndex !== -1) {
          // Find the end of ~mods directory (next backslash after ~mods)
          const afterModsIndex = firstMod.filePath.indexOf('\\', modsIndex)
          const modDirPath = afterModsIndex !== -1
            ? firstMod.filePath.substring(0, afterModsIndex)
            : firstMod.filePath.substring(0, modsIndex + 5) // 5 is length of "~mods"
          await openPath(modDirPath)
        } else {
          toast.error('Could not locate mods directory')
        }
      } else {
        toast.error('No mods found. Install a mod first to open the directory.')
      }
    } catch (error) {
      console.error('Failed to open mod directory:', error)
      toast.error('Failed to open mod directory')
    }
  }

  const handleEnableAll = async () => {
    if (!filteredMods || filteredMods.length === 0) {
      toast.info('No mods to enable')
      return
    }

    const disabledMods = filteredMods.filter(mod => !mod.enabled)
    if (disabledMods.length === 0) {
      toast.info('All mods are already enabled')
      return
    }

    setShowBulkProgress(true)
    setBulkOperation('enable')
    setBulkProgressTotal(disabledMods.length)
    setBulkProgressCurrent(0)

    let successCount = 0
    for (let i = 0; i < disabledMods.length; i++) {
      try {
        await toggleMod.mutateAsync({ modId: disabledMods[i]!.id, enabled: true })
        successCount++
      } catch (error) {
        console.error(`Failed to enable mod ${disabledMods[i]!.name}:`, error)
      }
      setBulkProgressCurrent(i + 1)
    }

    setShowBulkProgress(false)
    toast.success(`Enabled ${successCount} mod${successCount !== 1 ? 's' : ''}`)
  }

  const handleDisableAll = async () => {
    if (!filteredMods || filteredMods.length === 0) {
      toast.info('No mods to disable')
      return
    }

    const enabledMods = filteredMods.filter(mod => mod.enabled)
    if (enabledMods.length === 0) {
      toast.info('All mods are already disabled')
      return
    }

    setShowBulkProgress(true)
    setBulkOperation('disable')
    setBulkProgressTotal(enabledMods.length)
    setBulkProgressCurrent(0)

    let successCount = 0
    for (let i = 0; i < enabledMods.length; i++) {
      try {
        await toggleMod.mutateAsync({ modId: enabledMods[i]!.id, enabled: false })
        successCount++
      } catch (error) {
        console.error(`Failed to disable mod ${enabledMods[i]!.name}:`, error)
      }
      setBulkProgressCurrent(i + 1)
    }

    setShowBulkProgress(false)
    toast.success(`Disabled ${successCount} mod${successCount !== 1 ? 's' : ''}`)
  }

  const handleOrganizeMods = async () => {
    try {
      toast.info('Organizing loose mods...')
      const count = await invoke<number>('organize_mods')
      if (count > 0) {
        toast.success(`Organized ${count} loose mod(s) into folders`)
      } else {
        toast.info('No loose mods found to organize')
      }
    } catch (error) {
      console.error('Failed to organize mods:', error)
      toast.error(`Failed to organize mods: ${error}`)
    }
  }

  const handleDeleteAll = () => {
    if (!filteredMods || filteredMods.length === 0) {
      toast.info('No mods to delete')
      return
    }

    setShowDeleteConfirm(true)
  }

  const confirmDeleteAll = async () => {
    setShowDeleteConfirm(false)

    if (!filteredMods) return

    setShowBulkProgress(true)
    setBulkOperation('delete')
    setBulkProgressTotal(filteredMods.length)
    setBulkProgressCurrent(0)

    let successCount = 0
    for (let i = 0; i < filteredMods.length; i++) {
      try {
        await deleteMod.mutateAsync(filteredMods[i]!.id)
        successCount++
      } catch (error) {
        console.error(`Failed to delete mod ${filteredMods[i]!.name}:`, error)
      }
      setBulkProgressCurrent(i + 1)
    }

    setShowBulkProgress(false)
    toast.success(`Deleted ${successCount} mod${successCount !== 1 ? 's' : ''}`)
  }

  // Profile handlers
  const handleSelectProfile = (profileId: string) => {
    if (activeProfileFilter === profileId) {
      setActiveProfileFilter(null) // Deselect if already selected
    } else {
      setActiveProfileFilter(profileId)
    }
  }

  const handleEditProfile = (profileId: string) => {
    setProfileDialogOpen(true, 'edit', profileId)
  }

  const handleDisableProfileMods = async (profileId: string) => {
    const profileMods = filteredMods.filter(mod =>
      mod.metadata.profileIds?.includes(profileId) && mod.enabled
    )

    if (profileMods.length === 0) {
      toast.info('No enabled mods in this profile')
      return
    }

    setShowBulkProgress(true)
    setBulkOperation('disableProfile')
    setBulkProgressTotal(profileMods.length)
    setBulkProgressCurrent(0)

    let successCount = 0
    for (let i = 0; i < profileMods.length; i++) {
      try {
        await toggleMod.mutateAsync({ modId: profileMods[i]!.id, enabled: false })
        successCount++
      } catch (error) {
        console.error(`Failed to disable mod ${profileMods[i]!.name}:`, error)
      }
      setBulkProgressCurrent(i + 1)
    }

    setShowBulkProgress(false)
    toast.success(`Disabled ${successCount} mod${successCount !== 1 ? 's' : ''} from profile`)
  }

  const handleDeleteProfileTag = (profileId: string) => {
    setProfileToDelete(profileId)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteProfileTag = async () => {
    if (!profileToDelete) return

    const profile = profiles.find(p => p.id === profileToDelete)
    if (!profile) return

    setShowDeleteConfirm(false)

    try {
      // Remove profile ID from all mods in the backend
      await removeProfileFromAllMods.mutateAsync(profileToDelete)

      // Delete the profile from the UI store
      deleteProfile(profileToDelete)
      setProfileToDelete(null)

      toast.success(`Profile "${profile.name}" deleted and removed from all mods`)
    } catch (error) {
      console.error('Failed to delete profile:', error)
      // Still clean up the UI state even if backend fails
      deleteProfile(profileToDelete)
      setProfileToDelete(null)
    }
  }

  const handleDisableAllNsfw = async () => {
    const nsfwMods = filteredMods.filter(mod => mod.metadata.isNsfw && mod.enabled)

    if (nsfwMods.length === 0) {
      toast.info('No enabled NSFW mods to disable')
      return
    }

    setShowBulkProgress(true)
    setBulkOperation('disableNsfw')
    setBulkProgressTotal(nsfwMods.length)
    setBulkProgressCurrent(0)

    let successCount = 0
    for (let i = 0; i < nsfwMods.length; i++) {
      try {
        await toggleMod.mutateAsync({ modId: nsfwMods[i]!.id, enabled: false })
        successCount++
      } catch (error) {
        console.error(`Failed to disable NSFW mod ${nsfwMods[i]!.name}:`, error)
      }
      setBulkProgressCurrent(i + 1)
    }

    setShowBulkProgress(false)
    toast.success(`Disabled ${successCount} NSFW mod${successCount !== 1 ? 's' : ''}`)
  }

  const totalMods = filteredMods.length

  return (
    <div className="flex flex-col h-full border-r bg-background">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2">
          {/* All Mods */}
          <button
            onClick={() => setFilters({ category: null, character: null, showFavorites: false })}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm group transition-all duration-200',
              filters.category === null && filters.character === null && !filters.showFavorites
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-primary/20 hover:text-primary'
            )}
          >
            <Folder className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
            <span className="flex-1 text-left">All Mods</span>
            <span className="text-xs opacity-70">{totalMods}</span>
          </button>

          {/* Favorites - only show if there are favorite mods */}
          {favoriteCount > 0 && (
            <button
              onClick={() => setFilters({ category: null, character: null, showFavorites: true })}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm group transition-all duration-200 mt-1',
                filters.showFavorites
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-primary/20 hover:text-primary'
              )}
            >
              <Star className={`h-4 w-4 transition-all duration-200 ${filters.showFavorites ? 'fill-current' : ''} group-hover:rotate-12`} />
              <span className="flex-1 text-left">Favorites</span>
              <span className="text-xs opacity-70">{favoriteCount}</span>
            </button>
          )}

          {/* Category Groups */}
          {(['UI', 'Audio', 'Skins', 'Gameplay'] as ModCategory[]).map(category => (
            <div key={category} className="mt-1">
              <button
                onClick={() => selectCategory(category)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm group transition-all duration-200',
                  filters.category === category && filters.character === null
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-primary/20 hover:text-primary'
                )}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    expandedCategories[category] ? "rotate-0" : "-rotate-90"
                  )}
                />
                <span className="transition-transform duration-200 group-hover:rotate-12 inline-flex">
                  {getCategoryIcon(category)}
                </span>
                <span className="flex-1 text-left">{category}</span>
                <span className="text-xs opacity-70">{categoryCounts[category] || 0}</span>
              </button>

              {/* Character Filters with smooth CSS animation */}
              <div
                className={cn(
                  "grid transition-all duration-200 ease-in-out overflow-hidden",
                  expandedCategories[category]
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <div className="ml-6 mt-1 space-y-0.5 pb-1">
                    {ALL_CHARACTERS.map(character => {
                      const count = characterCountsByCategory[category]?.[character] || 0
                      if (count === 0) return null

                      return (
                        <button
                          key={character}
                          onClick={() => selectCharacter(character, category)}
                          className={cn(
                            'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs group transition-all duration-200',
                            filters.character === character && filters.category === category
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-primary/20 hover:text-primary'
                          )}
                        >
                          <img
                            src={getCharacterIconPath(character)}
                            alt={character}
                            className="w-5 h-5 rounded-full object-cover border border-border transition-transform duration-200 group-hover:rotate-12"
                            onError={(e) => {
                              // Fallback to initials if image fails to load
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const fallback = target.nextElementSibling as HTMLElement
                              if (fallback) fallback.style.display = 'flex'
                            }}
                          />
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border border-border transition-transform duration-200 group-hover:rotate-12" style={{ display: 'none' }}>
                            {character.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="flex-1 text-left">{character}</span>
                          <span className="opacity-70">{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Profiles Section */}
      <div className="border-t border-border flex-shrink-0">
        <button
          onClick={() => setProfilesExpanded(!profilesExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          <Tag className="h-4 w-4" />
          <span className="flex-1 text-left font-medium">Profiles</span>
          <span className="text-xs text-muted-foreground">{profiles.length}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              profilesExpanded ? "rotate-0" : "-rotate-90"
            )}
          />
        </button>

        <AnimatePresence>
          {profilesExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 space-y-1">
                {/* Create New Profile Button */}
                <button
                  onClick={() => setProfileDialogOpen(true, 'create')}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-[#191F24] border border-transparent transition-all duration-200 group hover:bg-primary/20 hover:text-primary hover:border-primary/40"
                >
                  <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
                  <span className="flex-1 text-left">Create Profile</span>
                </button>

                {/* Profile List */}
                {profiles.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                    No profiles yet. Create one to organize your mods!
                  </div>
                ) : (
                  profiles.map(profile => (
                    <ProfileItem
                      key={profile.id}
                      profile={profile}
                      active={activeProfileFilter === profile.id}
                      modCount={profileCounts[profile.id] || 0}
                      onSelect={() => handleSelectProfile(profile.id)}
                      onEdit={() => handleEditProfile(profile.id)}
                      onDisableAll={() => handleDisableProfileMods(profile.id)}
                      onDelete={() => handleDeleteProfileTag(profile.id)}
                    />
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tools Section */}
      <div className="border-t border-border flex-shrink-0">
        <button
          onClick={() => setToolsExpanded(!toolsExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          <Settings className="h-4 w-4" />
          <span className="flex-1 text-left font-medium">Tools</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              toolsExpanded ? "rotate-0" : "-rotate-90"
            )}
          />
        </button>

        <AnimatePresence>
          {toolsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 space-y-1">
                {/* Enable All */}
                <button
                  onClick={handleEnableAll}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-[#191F24] border border-transparent transition-all duration-200 group hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/40"
                >
                  <CircleCheck className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
                  <span className="flex-1 text-left">Enable All</span>
                </button>

                {/* Disable All */}
                <button
                  onClick={handleDisableAll}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-[#191F24] border border-transparent transition-all duration-200 group hover:bg-yellow-500/20 hover:text-yellow-400 hover:border-yellow-500/40"
                >
                  <CircleX className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
                  <span className="flex-1 text-left">Disable All</span>
                </button>

                {/* Disable All NSFW - only show if NSFW mods exist and are shown */}
                {hasNsfwMods && filters.showNsfw && (
                  <button
                    onClick={handleDisableAllNsfw}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-[#191F24] border border-transparent transition-all duration-200 group hover:bg-orange-500/20 hover:text-orange-400 hover:border-orange-500/40"
                  >
                    <CircleX className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
                    <span className="flex-1 text-left">Disable All NSFW</span>
                  </button>
                )}

                {/* Organize Mods Folder */}
                <button
                  onClick={handleOrganizeMods}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-[#191F24] border border-transparent transition-all duration-200 group hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/40"
                >
                  <FolderCog className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                  <span className="flex-1 text-left">Organize Mods Folder</span>
                </button>

                {/* Delete All */}
                <button
                  onClick={handleDeleteAll}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-[#191F24] border border-transparent transition-all duration-200 group hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40"
                >
                  <Trash2 className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
                  <span className="flex-1 text-left">Delete All</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* App Version Section */}
      <div className="border-t border-border flex-shrink-0">
        <button
          onClick={() => setAppVersionExpanded(!appVersionExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          <div className="relative">
            <Info className="h-4 w-4" />
            {/* Alert badge when update is available */}
            {availableUpdate && (
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-1 -right-1"
              >
                <AlertCircle className="h-3.5 w-3.5 text-red-500 fill-red-500" />
              </motion.div>
            )}
          </div>
          <span className="flex-1 text-left font-medium">App Version</span>
          <span className="text-xs opacity-70">v{APP_VERSION}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              appVersionExpanded ? "rotate-0" : "-rotate-90"
            )}
          />
        </button>

        <AnimatePresence>
          {appVersionExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 space-y-1">
                {/* Changelog */}
                <button
                  onClick={() => setChangelogDialogOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-[#191F24] border border-transparent transition-all duration-200 group hover:bg-purple-500/20 hover:text-purple-400 hover:border-purple-500/40"
                >
                  <BookOpen className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                  <span className="flex-1 text-left">Changelog</span>
                </button>

                {/* Check for Update */}
                <button
                  onClick={() => setUpdateDialogOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-[#191F24] border border-transparent transition-all duration-200 group hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/40"
                >
                  <div className="relative">
                    <RefreshCw className="h-4 w-4 transition-transform duration-200 group-hover:rotate-180" />
                    {/* Alert badge when update is available */}
                    {availableUpdate && (
                      <motion.div
                        initial={{ opacity: 1 }}
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -top-1 -right-1"
                      >
                        <AlertCircle className="h-3.5 w-3.5 text-red-500 fill-red-500" />
                      </motion.div>
                    )}
                  </div>
                  <span className="flex-1 text-left">Check for Updates</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Open Mod Directory Button */}
      <div className="p-2 border-t border-border flex-shrink-0">
        <button
          onClick={handleOpenModDirectory}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white bg-[#191F24] border border-border transition-all duration-200 group hover:bg-primary/20 hover:text-primary hover:border-primary/40"
        >
          <FolderOpen className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
          <span className="flex-1 text-left">Open Mod Directory</span>
        </button>
      </div>

      {/* Bulk Operation Progress Dialog */}
      {showBulkProgress && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="animate-spin">
                  <Settings className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">
                  {bulkOperation === 'enable' && 'Enabling Mods'}
                  {bulkOperation === 'disable' && 'Disabling Mods'}
                  {bulkOperation === 'disableNsfw' && 'Disabling NSFW Mods'}
                  {bulkOperation === 'disableProfile' && 'Disabling Profile Mods'}
                  {bulkOperation === 'delete' && 'Deleting Mods'}
                </h2>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-300 ease-out",
                      bulkOperation === 'enable' && "bg-green-500",
                      (bulkOperation === 'disable' || bulkOperation === 'disableNsfw' || bulkOperation === 'disableProfile') && "bg-orange-500",
                      bulkOperation === 'delete' && "bg-red-500"
                    )}
                    style={{ width: `${bulkProgressTotal > 0 ? Math.round((bulkProgressCurrent / bulkProgressTotal) * 100) : 0}%` }}
                  />
                </div>

                {/* Progress Text */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Processing mod {bulkProgressCurrent} of {bulkProgressTotal}...</span>
                  <span className="font-medium">{bulkProgressTotal > 0 ? Math.round((bulkProgressCurrent / bulkProgressTotal) * 100) : 0}%</span>
                </div>
              </div>

              {/* Info Text */}
              <p className="text-xs text-muted-foreground text-center">
                Please wait while mods are being {bulkOperation === 'enable' ? 'enabled' : bulkOperation === 'disable' ? 'disabled' : 'deleted'}.
                This may take a moment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                  <Trash2 className="h-5 w-5 text-red-500" />
                </div>
                <h2 className="text-lg font-semibold">
                  {profileToDelete ? 'Delete Profile' : 'Delete All Mods'}
                </h2>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground">
                {profileToDelete ? (
                  <>
                    Are you sure you want to delete the profile "{profiles.find(p => p.id === profileToDelete)?.name}"?
                    This will remove the profile tag from all mods.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete all {filteredMods?.length || 0} mod{filteredMods?.length !== 1 ? 's' : ''}?
                    This action cannot be undone.
                  </>
                )}
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setProfileToDelete(null)
                  }}
                  className="flex-1 px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={profileToDelete ? confirmDeleteProfileTag : confirmDeleteAll}
                  className="flex-1 px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  {profileToDelete ? 'Delete Profile' : 'Delete All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Dialog */}
      <ProfileDialog />
    </div>
  )
}
