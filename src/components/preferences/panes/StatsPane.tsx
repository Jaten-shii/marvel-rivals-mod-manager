import React from 'react'
import { Crown, BarChart3, Trophy } from 'lucide-react'
import { useGetMods } from '@/hooks/useMods'
import { useUIStore } from '@/stores'
import { useUIStore as usePrefsStore } from '@/store/ui-store'
import type { ModCategory, Character } from '@/types/mod.types'
import { c, tint, categoryColor, formatFileSize, getCharacterIconPath, withViewTransition } from '@/shared/rivals-tokens'
import { CategoryIcon, RingAvatar } from '@/shared/rivals-design'
import { SettingsSection, SettingsCard } from '../settings-ui'

const CATS: ModCategory[] = ['Skins', 'Audio', 'UI', 'Gameplay']

export const StatsPane: React.FC = () => {
  const { data: mods } = useGetMods()
  const showNsfw = useUIStore((s) => s.filters.showNsfw)
  const setFilters = useUIStore((s) => s.setFilters)
  const setPreferencesOpen = usePrefsStore((s) => s.setPreferencesOpen)

  // Respect the NSFW lock, same as everywhere else in the app
  const visible = React.useMemo(
    () => (mods ?? []).filter((m) => showNsfw || !m.metadata.isNsfw),
    [mods, showNsfw]
  )

  const stats = React.useMemo(() => {
    const total = visible.length
    const enabled = visible.filter((m) => m.enabled).length
    const disk = visible.reduce((s, m) => s + (m.fileSize || 0), 0)
    const addons = visible.filter((m) => m.metadata.parentModId).length

    const catCounts = CATS.map((cat) => ({ cat, count: visible.filter((m) => m.category === cat).length }))
    const maxCat = Math.max(1, ...catCounts.map((x) => x.count))

    const charMap = new Map<string, number>()
    for (const m of visible) {
      if (m.character && m.character !== 'All Characters') charMap.set(m.character, (charMap.get(m.character) || 0) + 1)
    }
    const heroes = [...charMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8)
    const maxHero = Math.max(1, ...heroes.map(([, n]) => n))

    let biggest = visible[0] ?? null
    let newest = visible[0] ?? null
    for (const m of visible) {
      if (!biggest || (m.fileSize || 0) > (biggest.fileSize || 0)) biggest = m
      if (!newest || new Date(m.installDate).getTime() > new Date(newest.installDate).getTime()) newest = m
    }

    const nsfwCount = showNsfw ? visible.filter((m) => m.metadata.isNsfw).length : null
    const favoriteCount = visible.filter((m) => m.isFavorite).length

    return { total, enabled, disk, addons, catCounts, maxCat, heroes, maxHero, biggest, newest, nsfwCount, favoriteCount }
  }, [visible, showNsfw])

  // Clicking a stat applies the filter and drops you into the library
  const jumpToCategory = (cat: ModCategory) => {
    setPreferencesOpen(false)
    withViewTransition(() => setFilters({ category: cat, character: null, showFavorites: false }))
  }
  const jumpToCharacter = (ch: string) => {
    setPreferencesOpen(false)
    withViewTransition(() => setFilters({ character: ch as Character, category: null, showFavorites: false }))
  }

  const heroBlocks = [
    { label: 'Total Mods', value: String(stats.total) },
    { label: 'Active', value: String(stats.enabled), sub: stats.total > 0 ? `${Math.round((stats.enabled / stats.total) * 100)}%` : undefined },
    { label: 'On Disk', value: formatFileSize(stats.disk) },
  ]

  return (
    <>
      {/* Headline numbers */}
      <SettingsSection title="Your Library" icon={<BarChart3 className="w-4 h-4" />}>
        <SettingsCard pad={20}>
          <div className="flex items-center justify-around">
            {heroBlocks.map((b, i) => (
              <React.Fragment key={b.label}>
                {i > 0 && <span className="card-credits-slash" style={{ height: 34 }} />}
                <div className="text-center" style={{ animation: `metadata-fade-in 420ms cubic-bezier(0.22,1,0.36,1) ${i * 80}ms both` }}>
                  <div className="rivals-condensed" style={{ color: c.ink, fontSize: 40, fontWeight: 800, lineHeight: 1, letterSpacing: '0.01em' }}>
                    {b.value}
                    {b.sub && <span style={{ color: c.ok, fontSize: 15, marginLeft: 7, letterSpacing: '0.06em' }}>{b.sub}</span>}
                  </div>
                  <div className="rivals-mono" style={{ color: c.ink3, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 7 }}>
                    {b.label}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Category split */}
      <SettingsSection title="By Category" icon={<BarChart3 className="w-4 h-4" />}>
        <SettingsCard pad={16} className="space-y-1">
          {stats.catCounts.map(({ cat, count }, i) => {
            const col = categoryColor(cat)
            return (
              <button
                key={cat}
                onClick={() => jumpToCategory(cat)}
                data-tip={`Show ${cat} mods`}
                className="w-full flex items-center gap-3 rounded-md cursor-pointer transition-colors"
                style={{ padding: '8px 10px', background: 'transparent', border: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = tint(col, 8) }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span className="grid place-items-center flex-shrink-0" style={{ width: 20 }}>
                  <CategoryIcon category={cat} stroke={col} size={14} />
                </span>
                <span className="rivals-condensed flex-shrink-0 text-left" style={{ color: c.ink2, fontSize: 14.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', width: 90 }}>
                  {cat}
                </span>
                <span className="flex-1" style={{ height: 8, borderRadius: 4, background: tint(col, 10), overflow: 'hidden' }}>
                  <span
                    className="block h-full stats-bar"
                    style={{ width: `${(count / stats.maxCat) * 100}%`, background: `linear-gradient(90deg, ${tint(col, 55)}, ${col})`, borderRadius: 4, animationDelay: `${120 + i * 90}ms` }}
                  />
                </span>
                <span className="rivals-mono flex-shrink-0 text-right" style={{ color: c.ink2, fontSize: 13, fontWeight: 600, width: 40 }}>{count}</span>
              </button>
            )
          })}
        </SettingsCard>
      </SettingsSection>

      {/* Hero leaderboard */}
      <SettingsSection title="Hero Leaderboard" icon={<Trophy className="w-4 h-4" />}>
        <SettingsCard pad={16} className="space-y-0.5">
          {stats.heroes.length === 0 ? (
            <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 12.5, fontStyle: 'italic', padding: '4px 6px' }}>
              No character mods yet — install some skins and the podium fills up.
            </p>
          ) : (
            stats.heroes.map(([ch, count], i) => {
              const first = i === 0
              const barColor = first ? c.warn : c.accent
              return (
                <button
                  key={ch}
                  onClick={() => jumpToCharacter(ch)}
                  data-tip={`Show ${ch} mods`}
                  className="w-full flex items-center gap-3 rounded-md cursor-pointer transition-colors"
                  style={{ padding: '7px 10px', background: 'transparent', border: 'none', animation: `metadata-fade-in 380ms cubic-bezier(0.22,1,0.36,1) ${i * 55}ms both` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = tint(barColor, 8) }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span className="rivals-mono flex-shrink-0 text-right" style={{ color: first ? c.warn : c.muted, fontSize: 11, fontWeight: 700, width: 20 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="relative flex-shrink-0 inline-flex">
                    <RingAvatar src={getCharacterIconPath(ch)} alt={ch} size={30} />
                    {first && <Crown className="absolute" style={{ width: 13, height: 13, top: -7, left: '50%', transform: 'translateX(-50%) rotate(-8deg)', color: c.warn, fill: c.warn }} />}
                  </span>
                  <span className="rivals-condensed flex-shrink-0 text-left truncate" style={{ color: c.ink2, fontSize: 14.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', width: 150 }}>
                    {ch}
                  </span>
                  <span className="flex-1" style={{ height: 7, borderRadius: 4, background: tint(barColor, 9), overflow: 'hidden' }}>
                    <span
                      className="block h-full stats-bar"
                      style={{ width: `${(count / stats.maxHero) * 100}%`, background: `linear-gradient(90deg, ${tint(barColor, 50)}, ${barColor})`, borderRadius: 4, animationDelay: `${200 + i * 70}ms` }}
                    />
                  </span>
                  <span className="rivals-mono flex-shrink-0 text-right" style={{ color: c.ink2, fontSize: 13, fontWeight: 600, width: 34 }}>{count}</span>
                </button>
              )
            })
          )}
        </SettingsCard>
      </SettingsSection>

      {/* Records */}
      <SettingsSection title="Records" icon={<Crown className="w-4 h-4" />}>
        <SettingsCard pad={16}>
          {[
            { label: 'Biggest Mod', value: stats.biggest ? `${stats.biggest.metadata.title || stats.biggest.name} · ${formatFileSize(stats.biggest.fileSize)}` : '—' },
            { label: 'Latest Addition', value: stats.newest ? `${stats.newest.metadata.title || stats.newest.name} · ${new Date(stats.newest.installDate).toLocaleDateString()}` : '—' },
            { label: 'Favorites', value: String(stats.favoriteCount) },
            { label: 'Add-ons Attached', value: String(stats.addons) },
            ...(stats.nsfwCount !== null ? [{ label: 'NSFW In Library', value: String(stats.nsfwCount) }] : []),
          ].map((row, i) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4"
              style={{ padding: '9px 2px', borderTop: i === 0 ? 'none' : `1px solid ${c.line}` }}
            >
              <span className="rivals-mono flex-shrink-0" style={{ color: c.ink3, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{row.label}</span>
              <span className="rivals-mono truncate" style={{ color: c.ink, fontSize: 12.5, fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </SettingsCard>
      </SettingsSection>
    </>
  )
}
