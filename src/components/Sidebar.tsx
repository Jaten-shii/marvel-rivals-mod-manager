import { useState, useMemo, useCallback } from 'react'
import { FolderOpen, Plus, Settings, Trash2 } from 'lucide-react'
import { ScrollArea } from './ui/scroll-area'
import { useUIStore } from '@/stores'
import type { ModCategory, Character } from '@/types/mod.types'
import { useGetMods, useToggleMod, useRemoveProfileFromAllMods } from '@/hooks/useMods'
import { openPath } from '@tauri-apps/plugin-opener'
import { toast } from 'sonner'
import { ProfileItem } from './ProfileItem'
import { ProfileDialog } from './ProfileDialog'
import { ALL_CHARACTERS } from '@/shared/constants'
import { c, tint, categoryColor, formatFileSize, getCharacterIconPath } from '@/shared/rivals-tokens'
import { RingAvatar, SidebarCategoryIcon } from '@/shared/rivals-design'

// Tracked uppercase mono micro-heading.
function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 px-[18px] pt-[18px] pb-1.5"
      style={{ color: c.muted, fontFamily: c.mono, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}
    >
      <span className="flex-1">{children}</span>
      {right}
    </div>
  )
}

// Quick-filter row (All Mods / Enabled / Favorites).
function FilterRow({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md transition-colors"
      style={{
        background: active ? c.panelHi : 'transparent',
        boxShadow: active ? `inset 2px 0 0 ${c.accent}` : 'none',
        color: active ? c.ink : c.ink2,
        fontFamily: c.font,
        fontSize: 14.5,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = tint(c.accent, 8) }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <span className="flex-1 text-left">{label}</span>
      <span style={{ color: active ? c.ink2 : c.muted, fontFamily: c.mono, fontSize: 12.5 }}>{count}</span>
    </button>
  )
}

export function Sidebar() {
  const filters = useUIStore((state) => state.filters)
  const setFilters = useUIStore((state) => state.setFilters)
  const profiles = useUIStore((state) => state.profiles)
  const activeProfileFilter = useUIStore((state) => state.activeProfileFilter)
  const setProfileDialogOpen = useUIStore((state) => state.setProfileDialogOpen)
  const deleteProfile = useUIStore((state) => state.deleteProfile)

  const { data: mods } = useGetMods()
  const toggleMod = useToggleMod()
  const removeProfileFromAllMods = useRemoveProfileFromAllMods()

  const [heroFilter, setHeroFilter] = useState('')
  const [showBulkProgress, setShowBulkProgress] = useState(false)
  const [bulkProgressCurrent, setBulkProgressCurrent] = useState(0)
  const [bulkProgressTotal, setBulkProgressTotal] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null)

  // NSFW-respecting set drives all counts.
  const filteredMods = useMemo(
    () => mods?.filter((mod) => filters.showNsfw || !mod.metadata.isNsfw) || [],
    [mods, filters.showNsfw]
  )

  const totalMods = filteredMods.length
  const enabledCount = useMemo(() => filteredMods.filter((m) => m.enabled).length, [filteredMods])
  const disabledCount = useMemo(() => filteredMods.filter((m) => !m.enabled).length, [filteredMods])
  const favoriteCount = useMemo(() => filteredMods.filter((m) => m.isFavorite).length, [filteredMods])

  const categoryCounts = useMemo(
    () =>
      filteredMods.reduce((acc, mod) => {
        acc[mod.category] = (acc[mod.category] || 0) + 1
        return acc
      }, {} as Record<ModCategory, number>),
    [filteredMods]
  )

  const characterCounts = useMemo(
    () =>
      filteredMods.reduce((acc, mod) => {
        if (mod.character && mod.character !== 'All Characters') acc[mod.character] = (acc[mod.character] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    [filteredMods]
  )

  const profileCounts = useMemo(
    () =>
      profiles.reduce((acc, profile) => {
        acc[profile.id] = filteredMods.filter((mod) => mod.metadata.profileIds?.includes(profile.id)).length
        return acc
      }, {} as Record<string, number>),
    [profiles, filteredMods]
  )

  // Storage usage bar: summed mod size vs an 8 GB visual scale (NOT real disk).
  const totalSize = useMemo(() => filteredMods.reduce((s, m) => s + (m.fileSize || 0), 0), [filteredMods])
  const sizePct = Math.min(100, Math.round((totalSize / (8 * 1024 * 1024 * 1024)) * 100))

  const visibleCharacters = useMemo(() => {
    const q = heroFilter.trim().toLowerCase()
    return ALL_CHARACTERS.filter((ch) => ch !== 'All Characters')
      .filter((ch) => (characterCounts[ch] || 0) > 0)
      .filter((ch) => !q || ch.toLowerCase().includes(q))
  }, [characterCounts, heroFilter])

  const CATEGORY_ROWS: ModCategory[] = ['Skins', 'Audio', 'UI', 'Gameplay']
  // Enabled/Disabled quick filters use the showEnabled/showDisabled flags.
  const enabledOnly = filters.showEnabled && !filters.showDisabled
  const disabledOnly = !filters.showEnabled && filters.showDisabled
  const isAllActive = filters.category === null && filters.character === null && !filters.showFavorites && filters.showEnabled && filters.showDisabled

  const selectCategory = useCallback((category: ModCategory) => {
    const { filters, setFilters } = useUIStore.getState()
    if (filters.category === category && !filters.character) setFilters({ category: null })
    else setFilters({ category, character: null, showFavorites: false })
  }, [])

  const selectCharacterGlobal = useCallback((character: Character) => {
    const { filters, setFilters } = useUIStore.getState()
    if (filters.character === character) setFilters({ character: null })
    else setFilters({ character, category: null, showFavorites: false })
  }, [])

  const handleOpenModDirectory = async () => {
    try {
      if (mods && mods.length > 0) {
        const firstMod = mods[0]
        if (!firstMod) {
          toast.error('Could not locate first mod')
          return
        }
        const modsIndex = firstMod.filePath.indexOf('~mods')
        if (modsIndex !== -1) {
          const afterModsIndex = firstMod.filePath.indexOf('\\', modsIndex)
          const modDirPath = afterModsIndex !== -1 ? firstMod.filePath.substring(0, afterModsIndex) : firstMod.filePath.substring(0, modsIndex + 5)
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

  // ── Profile handlers ──
  const handleSelectProfile = useCallback((profileId: string) => {
    const { activeProfileFilter, setActiveProfileFilter } = useUIStore.getState()
    setActiveProfileFilter(activeProfileFilter === profileId ? null : profileId)
  }, [])

  const handleEditProfile = useCallback((profileId: string) => {
    useUIStore.getState().setProfileDialogOpen(true, 'edit', profileId)
  }, [])

  const handleDisableProfileMods = async (profileId: string) => {
    const profileMods = filteredMods.filter((mod) => mod.metadata.profileIds?.includes(profileId) && mod.enabled)
    if (profileMods.length === 0) {
      toast.info('No enabled mods in this profile')
      return
    }
    setShowBulkProgress(true)
    setBulkProgressTotal(profileMods.length)
    setBulkProgressCurrent(0)
    let ok = 0
    let i = 0
    for (const mod of profileMods) {
      try {
        await toggleMod.mutateAsync({ modId: mod.id, enabled: false })
        ok++
      } catch (error) {
        console.error(`Failed to disable mod ${mod.name}:`, error)
      }
      setBulkProgressCurrent(++i)
    }
    setShowBulkProgress(false)
    toast.success(`Disabled ${ok} mod${ok !== 1 ? 's' : ''} from profile`)
  }

  const handleDeleteProfileTag = (profileId: string) => {
    setProfileToDelete(profileId)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteProfileTag = async () => {
    if (!profileToDelete) return
    const profile = profiles.find((p) => p.id === profileToDelete)
    if (!profile) return
    setShowDeleteConfirm(false)
    try {
      await removeProfileFromAllMods.mutateAsync(profileToDelete)
      deleteProfile(profileToDelete)
      setProfileToDelete(null)
      toast.success(`Profile "${profile.name}" deleted and removed from all mods`)
    } catch (error) {
      console.error('Failed to delete profile:', error)
      deleteProfile(profileToDelete)
      setProfileToDelete(null)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: c.panel, borderRight: `1px solid ${c.line}` }}>
      <ScrollArea type="always" className="flex-1 min-h-0 sidebar-scroll">
        {/* Quick filters */}
        <div className="px-3 pt-3 flex flex-col gap-0.5">
          <FilterRow
            label="All Mods"
            count={totalMods}
            active={isAllActive}
            onClick={() => setFilters({ category: null, character: null, showFavorites: false, showEnabled: true, showDisabled: true })}
          />
          <FilterRow
            label="Enabled"
            count={enabledCount}
            active={enabledOnly}
            onClick={() => setFilters({ showFavorites: false, showEnabled: true, showDisabled: enabledOnly ? true : false })}
          />
          <FilterRow
            label="Disabled"
            count={disabledCount}
            active={disabledOnly}
            onClick={() => setFilters({ showFavorites: false, showDisabled: true, showEnabled: disabledOnly ? true : false })}
          />
          {favoriteCount > 0 && (
            <FilterRow label="Favorites" count={favoriteCount} active={filters.showFavorites} onClick={() => setFilters({ category: null, character: null, showFavorites: true })} />
          )}
        </div>

        {/* Categories */}
        <SectionLabel>Categories</SectionLabel>
        <div className="px-3 flex flex-col gap-0.5">
          {CATEGORY_ROWS.map((category) => {
            const active = filters.category === category && filters.character === null
            return (
              <button
                key={category}
                onClick={() => selectCategory(category)}
                className="cat-row w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors"
                style={{
                  background: active ? c.panelHi : 'transparent',
                  boxShadow: active ? `inset 2px 0 0 ${c.accent}` : 'none',
                  color: active ? c.ink : c.ink2,
                  fontFamily: c.font,
                  fontSize: 14.5,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = tint(c.accent, 8) }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span className="grid place-items-center" style={{ width: 20, flex: '0 0 auto' }}>
                  <SidebarCategoryIcon category={category} color={categoryColor(category)} size={18} />
                </span>
                <span className="flex-1 text-left">{category}</span>
                <span style={{ color: active ? c.ink2 : c.muted, fontFamily: c.mono, fontSize: 12.5 }}>{categoryCounts[category] || 0}</span>
              </button>
            )
          })}
        </div>

        {/* Characters with search */}
        <SectionLabel
          right={
            filters.character ? (
              <button
                onClick={() => setFilters({ character: null })}
                style={{ color: c.accent, fontFamily: c.mono, fontSize: 9, letterSpacing: '0.06em', border: `1px solid ${tint(c.accent, 45)}`, borderRadius: 4, padding: '2px 6px' }}
                className="cursor-pointer"
              >
                Clear
              </button>
            ) : undefined
          }
        >
          Characters
        </SectionLabel>
        <div className="px-3 flex flex-col gap-px">
          <div className="relative mb-1">
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: c.muted, fontFamily: c.mono, fontSize: 11 }}>⌕</span>
            <input
              value={heroFilter}
              onChange={(e) => setHeroFilter(e.target.value)}
              placeholder="Filter characters…"
              className="w-full outline-none"
              style={{ padding: '6px 8px 6px 26px', background: c.bg, color: c.ink2, border: `1px solid ${c.line}`, borderRadius: 5, fontFamily: c.font, fontSize: 13 }}
            />
          </div>
          {visibleCharacters.map((character) => {
            const active = filters.character === character
            return (
              <button
                key={character}
                onClick={() => selectCharacterGlobal(character)}
                className={`sidebar-char-row w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors${active ? ' is-active' : ''}`}
                style={{
                  background: active ? c.panelHi : 'transparent',
                  color: active ? c.ink : c.ink2,
                  fontFamily: c.font,
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = tint(c.accent, 8) }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <RingAvatar src={getCharacterIconPath(character)} alt={character} size={26} active={active} />
                <span className="flex-1 text-left truncate">{character}</span>
                <span
                  className="rivals-mono"
                  style={{
                    minWidth: 22,
                    textAlign: 'center',
                    padding: '1px 7px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: active ? c.accent : tint(c.ink3, 12),
                    color: active ? c.onAccent : c.ink3,
                    transition: 'background 200ms ease, color 200ms ease',
                  }}
                >
                  {characterCounts[character]}
                </span>
              </button>
            )
          })}
          {visibleCharacters.length === 0 && (
            <div style={{ color: c.muted, fontFamily: c.font, fontSize: 11.5, fontStyle: 'italic', padding: '6px 8px' }}>No characters match.</div>
          )}
        </div>

        {/* Profiles */}
        <SectionLabel
          right={
            <button
              onClick={() => setProfileDialogOpen(true, 'create')}
              data-tip="New profile" aria-label="New profile"
              className="grid place-items-center cursor-pointer"
              style={{ width: 18, height: 18, borderRadius: 4, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.mono, fontSize: 11, lineHeight: 1 }}
            >
              +
            </button>
          }
        >
          Profiles
        </SectionLabel>
        <div className="px-3 pb-3 flex flex-col gap-0.5">
          {profiles.length === 0 ? (
            <button
              onClick={() => setProfileDialogOpen(true, 'create')}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer"
              style={{ background: 'transparent', color: c.ink3, border: `1px dashed ${c.line2}`, fontFamily: c.font, fontSize: 12.5 }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New profile…</span>
            </button>
          ) : (
            profiles.map((profile) => (
              <ProfileItem
                key={profile.id}
                profile={profile}
                active={activeProfileFilter === profile.id}
                modCount={profileCounts[profile.id] || 0}
                onSelect={handleSelectProfile}
                onEdit={handleEditProfile}
                onDisableAll={handleDisableProfileMods}
                onDelete={handleDeleteProfileTag}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer: storage bar + Open Folder */}
      <div className="px-[18px] py-3.5 flex-shrink-0" style={{ borderTop: `1px solid ${c.line}` }}>
        <div className="flex justify-between" style={{ color: c.ink3, fontFamily: c.mono, fontSize: 12 }}>
          <span>Mods size</span>
          <span>{formatFileSize(totalSize)}</span>
        </div>
        <div style={{ height: 4, marginTop: 8, background: c.line, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(2, sizePct)}%`, height: '100%', background: c.accent }} />
        </div>
        <button
          onClick={handleOpenModDirectory}
          className="w-full flex items-center justify-center gap-2 mt-3 px-3 py-2 rounded-md transition-colors cursor-pointer group"
          style={{ background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = tint(c.accent, 14); e.currentTarget.style.color = c.accent as string; e.currentTarget.style.borderColor = tint(c.accent, 45) }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink2 as string; e.currentTarget.style.borderColor = c.line2 }}
        >
          <FolderOpen className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
          <span>Open Folder</span>
        </button>
      </div>

      {/* Bulk progress (profile disable-all) */}
      {showBulkProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-lg p-6 animate-in zoom-in-95 duration-200" style={{ background: c.panel, border: `1px solid ${c.line2}` }}>
            <div className="flex items-center gap-3 mb-4">
              <Settings className="w-5 h-5 animate-spin" style={{ color: c.accent }} />
              <h2 className="rivals-display" style={{ color: c.ink, fontSize: 18, fontWeight: 600 }}>Disabling Profile Mods</h2>
            </div>
            <div style={{ height: 10, background: c.line, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${bulkProgressTotal > 0 ? Math.round((bulkProgressCurrent / bulkProgressTotal) * 100) : 0}%`, height: '100%', background: c.warn, transition: 'width .3s ease' }} />
            </div>
            <div className="flex justify-between mt-2" style={{ color: c.ink3, fontFamily: c.mono, fontSize: 12 }}>
              <span>Processing {bulkProgressCurrent} of {bulkProgressTotal}…</span>
              <span>{bulkProgressTotal > 0 ? Math.round((bulkProgressCurrent / bulkProgressTotal) * 100) : 0}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Delete profile confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-lg p-6 animate-in zoom-in-95 duration-200" style={{ background: c.panel, border: `1px solid ${c.line2}` }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="grid place-items-center" style={{ width: 40, height: 40, borderRadius: 999, background: tint(c.err, 18) }}>
                <Trash2 className="h-5 w-5" style={{ color: c.err }} />
              </div>
              <h2 className="rivals-display" style={{ color: c.ink, fontSize: 18, fontWeight: 600 }}>Delete Profile</h2>
            </div>
            <p style={{ color: c.ink2, fontFamily: c.font, fontSize: 13 }} className="mb-4">
              Are you sure you want to delete the profile &quot;{profiles.find((p) => p.id === profileToDelete)?.name}&quot;? This removes the profile tag from all mods.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setProfileToDelete(null) }}
                className="flex-1 cursor-pointer"
                style={{ padding: '8px 0', borderRadius: 6, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13, fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProfileTag}
                className="flex-1 cursor-pointer"
                style={{ padding: '8px 0', borderRadius: 6, background: c.err, color: '#fff', border: 'none', fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
              >
                Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}

      <ProfileDialog />
    </div>
  )
}
