import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { PackageOpen, SearchX } from 'lucide-react';
import { useGetMods, useGetAllCostumes, useToggleModEnabled, useToggleFavorite, useModConflicts } from '../hooks/useMods';
import { useUIStore } from '../stores';
import type { ModInfo, Costume, ModCategory, Character } from '../types/mod.types';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ModContextMenu } from './ModContextMenu';
import { BulkActionStrip } from './BulkActionStrip';
import { ALL_CHARACTERS } from '../shared/constants';
import { c, tint, categoryColor, parseTitleParts, formatFileSize, getCharacterIconPath, getCostumeIconSrc, addonDisplayName } from '../shared/rivals-tokens';
import { CategoryIcon, WarnIcon, PlusIcon, HeroChip, RingAvatar } from '../shared/rivals-design';
import { useDominantColor } from '../hooks/useDominantColor';

// Lightweight animated wrapper using CSS transitions (GPU-accelerated)
const AnimatedCard = memo(function AnimatedCard({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  const delay = Math.min(index, 20) * 0.025;
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 duration-200 fill-mode-both self-start"
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
});

function getCostumeForMod(
  mod: ModInfo,
  allCostumes: Record<string, Costume[]> | undefined
): Costume | null {
  if (!mod.character || !mod.metadata.costume || !allCostumes) return null;
  const characterCostumes = allCostumes[mod.character];
  if (!characterCostumes) return null;
  return characterCostumes.find((c) => c.id === mod.metadata.costume) || null;
}

// Resolve a mod's thumbnail to a usable src.
function getThumbnailSrc(mod: ModInfo): string | null {
  return mod.thumbnailPath ? convertFileSrc(mod.thumbnailPath) : null;
}

// Cursor-tracked tilt + glow for mod cards. A callback ref attaches pointer
// listeners imperatively and writes CSS variables (no React re-renders) — the
// actual transform lives in App.css. MAX_TILT is small on purpose: a subtle
// lean toward the cursor, not a flip.
const MAX_TILT = 3; // degrees — subtle enough to keep text crisp
function useCardTilt() {
  return useCallback((el: HTMLDivElement | null) => {
    if (!el) return;

    const handleMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;  // 0..1
      const py = (e.clientY - r.top) / r.height;  // 0..1
      // Tilt toward the cursor; rotateX inverted follows y, rotateY follows x.
      el.style.setProperty('--tilt-x', `${(0.5 - py) * MAX_TILT * 2}deg`);
      el.style.setProperty('--tilt-y', `${(px - 0.5) * MAX_TILT * 2}deg`);
      el.style.setProperty('--glow-x', `${px * 100}%`);
      el.style.setProperty('--glow-y', `${py * 100}%`);
    };
    const handleLeave = () => {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    };

    el.addEventListener('pointermove', handleMove);
    el.addEventListener('pointerleave', handleLeave);
    // Cleanup runs when React detaches the ref (element unmount)
    return () => {
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerleave', handleLeave);
    };
  }, []);
}

// Category pill (filled, color-coded)
// Slim pill that fades slightly on hover.
const fadeIn = (e: React.MouseEvent<HTMLSpanElement>) => { e.currentTarget.style.opacity = '0.65'; };
const fadeOut = (e: React.MouseEvent<HTMLSpanElement>) => { e.currentTarget.style.opacity = '1'; };

function CategoryPill({ category, size = 'sm' }: { category: ModCategory; size?: 'sm' | 'lg' }) {
  const color = categoryColor(category);
  const pad = size === 'lg' ? '1.5px 10px' : '1px 9px';
  const fs = size === 'lg' ? 12 : 11.5;
  return (
    <span
      className="inline-flex items-center gap-1.5 transition-opacity"
      style={{
        padding: pad,
        borderRadius: 999,
        background: tint(color, 15),
        color,
        border: `1px solid ${tint(color, 35)}`,
        fontFamily: c.font,
        fontSize: fs,
        fontWeight: 500,
      }}
      onMouseEnter={fadeIn}
      onMouseLeave={fadeOut}
    >
      <CategoryIcon category={category} stroke={color} size={size === 'lg' ? 11 : 10} />
      {category}
    </span>
  );
}

// Tiny category chip for add-on rows.
function MiniCatPill({ category }: { category: ModCategory }) {
  const color = categoryColor(category);
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{ padding: '1px 6px', borderRadius: 999, background: tint(color, 15), color, border: `1px solid ${tint(color, 35)}`, fontFamily: c.font, fontSize: 9.5, fontWeight: 600, flex: '0 0 auto' }}
    >
      <CategoryIcon category={category} stroke={color} size={8} />
      {category}
    </span>
  );
}

function NsfwPill({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const pad = size === 'lg' ? '1.5px 10px' : '1px 9px';
  const fs = size === 'lg' ? 12 : 11.5;
  const red = 'var(--rivals-nsfw-bright)';
  return (
    <span
      className="inline-flex items-center gap-1.5 transition-opacity"
      style={{
        padding: pad,
        borderRadius: 999,
        background: tint(red, 22),
        color: red,
        border: `1px solid ${tint(red, 55)}`,
        fontFamily: c.font,
        fontSize: fs,
        fontWeight: 600,
      }}
      onMouseEnter={fadeIn}
      onMouseLeave={fadeOut}
    >
      <WarnIcon stroke={red} size={size === 'lg' ? 11 : 10} />
      NSFW
    </span>
  );
}

// ── Conflict badge (shown when a mod clashes with an unrelated mod) ───────────
function ConflictPill({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const pad = size === 'lg' ? '1.5px 10px' : '1px 9px';
  const fs = size === 'lg' ? 12 : 11.5;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        padding: pad,
        borderRadius: 999,
        background: tint(c.warn, 20),
        color: c.warn,
        border: `1px solid ${tint(c.warn, 48)}`,
        fontFamily: c.font,
        fontSize: fs,
        fontWeight: 600,
      }}
      data-tip="This mod overwrites the same files as another enabled mod"
    >
      <WarnIcon stroke={c.warn} size={size === 'lg' ? 11 : 10} />
      Conflict
    </span>
  );
}

// ── Subtitle (italic variant · tag) ──────────────────────────────────────────
function Subtitle({ variant, subtitle, fontSize }: { variant: string | null; subtitle: string | null; fontSize: number }) {
  if (!variant && !subtitle) return null;
  return (
    <div className="flex items-baseline gap-1.5" style={{ color: c.ink3, fontFamily: c.font, fontSize }}>
      {variant && <span style={{ fontStyle: 'italic', color: c.ink2 }}>{variant}</span>}
      {variant && subtitle && <span style={{ color: c.muted }}>·</span>}
      {subtitle && <span>{subtitle}</span>}
    </div>
  );
}

export function ModList() {
  const { data: mods, isLoading, error } = useGetMods();
  const { data: allCostumes } = useGetAllCostumes();
  const { data: conflicts } = useModConflicts();

  // Set of mod ids involved in at least one conflict, for the per-card badge.
  const conflictIds = useMemo(() => {
    const s = new Set<string>();
    for (const cf of conflicts ?? []) {
      for (const m of cf.mods) s.add(m.id);
    }
    return s;
  }, [conflicts]);

  const filters = useUIStore((state) => state.filters);
  const setFilters = useUIStore((state) => state.setFilters);
  const viewMode = useUIStore((state) => state.viewMode);
  const setSelectedModId = useUIStore((state) => state.setSelectedModId);
  const sortBy = useUIStore((state) => state.sortBy);
  const profiles = useUIStore((state) => state.profiles);
  const activeProfileFilter = useUIStore((state) => state.activeProfileFilter);

  const [contextMenu, setContextMenu] = useState<{ mod: ModInfo; x: number; y: number } | null>(null);
  // Per-mod add-on drawer state (shared across views), keyed by mod id.
  // Stored as explicit user overrides so a manual open/close always beats the
  // search-driven auto-expand (presence in the map = the user chose).
  const [addonOverrides, setAddonOverrides] = useState<Map<string, boolean>>(new Map());
  // Latest auto-expand set, readable from the stable toggle callback.
  const autoExpandRef = useRef<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setAddonOverrides((prev) => {
      const current = prev.get(id) ?? autoExpandRef.current.has(id);
      const next = new Map(prev);
      next.set(id, !current);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, mod: ModInfo) => {
    e.preventDefault();
    setContextMenu({ mod, x: e.clientX, y: e.clientY });
  }, []);

  // ── Filter ──
  // Per-mod predicate. NSFW lock always applies; the other criteria define
  // whether a mod "matches" the active filter (used for both parents & add-ons).
  const matchesFilter = useCallback((mod: ModInfo): boolean => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = `${mod.name} ${mod.metadata.title ?? ''} ${mod.character ?? ''} ${mod.metadata.author ?? ''} ${(mod.metadata.tags ?? []).join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.category && mod.category !== filters.category) return false;
    if (filters.character && mod.character !== filters.character) return false;
    if (!filters.showEnabled && mod.enabled) return false;
    if (!filters.showDisabled && !mod.enabled) return false;
    if (filters.showFavorites && !mod.isFavorite) return false;
    if (activeProfileFilter && !mod.metadata.profileIds?.includes(activeProfileFilter)) return false;
    return true;
  }, [filters, activeProfileFilter]);

  // NSFW lock filters everything out of view regardless.
  const visibleMods = useMemo(
    () => (mods ?? []).filter((m) => filters.showNsfw || !m.metadata.isNsfw),
    [mods, filters.showNsfw]
  );

  const filteredMods = useMemo(() => visibleMods.filter(matchesFilter), [visibleMods, matchesFilter]);

  // ── Sort ──
  const sortedMods = useMemo(() => {
    if (!filteredMods.length) return [];
    return [...filteredMods].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
        case 'category':
          if (a.category !== b.category) return a.category.localeCompare(b.category);
          return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
        case 'character': {
          const aChar = a.character || 'zzz';
          const bChar = b.character || 'zzz';
          if (aChar !== bChar) return aChar.localeCompare(bChar);
          const aLow = (a.metadata.costume || '').trim().toLowerCase();
          const bLow = (b.metadata.costume || '').trim().toLowerCase();
          const aDef = !a.metadata.costume || aLow === 'default' || aLow === '';
          const bDef = !b.metadata.costume || bLow === 'default' || bLow === '';
          if (aDef !== bDef) return aDef ? -1 : 1;
          const aCost = a.metadata.costume || '';
          const bCost = b.metadata.costume || '';
          if (aCost !== bCost) return aCost.localeCompare(bCost);
          const order: Record<string, number> = { Skins: 1, UI: 2, Audio: 3, Gameplay: 4 };
          const ao = order[a.category] || 999;
          const bo = order[b.category] || 999;
          if (ao !== bo) return ao - bo;
          return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
        }
        case 'updated':
          return new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime();
        case 'profile': {
          const aHas = (a.metadata.profileIds?.length || 0) > 0;
          const bHas = (b.metadata.profileIds?.length || 0) > 0;
          if (aHas !== bHas) return bHas ? 1 : -1;
          if (aHas && bHas) {
            const ap = profiles.find((p) => p.id === a.metadata.profileIds?.[0]);
            const bp = profiles.find((p) => p.id === b.metadata.profileIds?.[0]);
            if (ap && bp) {
              const cmp = ap.name.localeCompare(bp.name);
              if (cmp !== 0) return cmp;
            }
          }
          return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
        }
        case 'date':
        default:
          return new Date(b.installDate).getTime() - new Date(a.installDate).getTime();
      }
    });
  }, [filteredMods, sortBy, profiles]);

  // ── Group add-ons under their parent ──
  // Build the FULL parent→addons map from all visible mods (so every parent
  // carries its complete add-on list), then decide which parents to show:
  // a parent shows if it matches the filter OR any of its add-ons match.
  // Parents shown only/partly via a matching add-on get auto-expanded, and the
  // matching add-on rows are flagged for highlighting.
  const { parentMods, addonsByParent, autoExpandIds, highlightAddonIds, addonCount } = useMemo(() => {
    const allAddonsByParent = new Map<string, ModInfo[]>();
    const allParents: ModInfo[] = [];
    const seen = new Set<string>();
    for (const mod of visibleMods) {
      if (seen.has(mod.id)) continue;
      seen.add(mod.id);
      if (mod.metadata.parentModId) {
        const arr = allAddonsByParent.get(mod.metadata.parentModId) || [];
        arr.push(mod);
        allAddonsByParent.set(mod.metadata.parentModId, arr);
      } else {
        allParents.push(mod);
      }
    }

    const filterActive = !!(
      filters.search || filters.category || filters.character || filters.showFavorites ||
      activeProfileFilter || !filters.showEnabled || !filters.showDisabled
    );
    const matchedParentIds = new Set(filteredMods.filter((m) => !m.metadata.parentModId).map((m) => m.id));
    const highlightAddonIds = new Set<string>();
    const autoExpandIds = new Set<string>();

    const parentIds = new Set(allParents.map((p) => p.id));
    const shownParents: ModInfo[] = [];
    for (const parent of allParents) {
      const addons = allAddonsByParent.get(parent.id) || [];
      const parentMatches = matchedParentIds.has(parent.id);
      const matchingAddons = filterActive ? addons.filter(matchesFilter) : [];

      if (parentMatches || matchingAddons.length > 0) {
        shownParents.push(parent);
        // Auto-open + highlight only when a matching ADD-ON is the reason the
        // card is shown at all (the parent itself doesn't match the filter),
        // e.g. the UI category revealing a UI add-on under a Skins mod. When
        // the parent matches too (clicking a character matches the parent AND
        // all its add-ons), force-opening every drawer would just hide the art.
        if (!parentMatches && matchingAddons.length > 0) {
          autoExpandIds.add(parent.id);
          for (const a of matchingAddons) highlightAddonIds.add(a.id);
        }
      }
    }

    // Orphaned add-ons (their parent isn't a visible top-level mod) should still
    // appear as their own cards so they're never lost. Show them if matching
    // (or always when no filter is active).
    for (const mod of visibleMods) {
      if (!mod.metadata.parentModId) continue;
      if (parentIds.has(mod.metadata.parentModId)) continue; // handled under its parent
      if (filterActive ? matchesFilter(mod) : true) {
        shownParents.push(mod);
      }
    }

    // Order shown parents using the sorted parent order from `sortedMods`.
    const order = new Map<string, number>();
    sortedMods.forEach((m, i) => { if (!order.has(m.id)) order.set(m.id, i); });
    shownParents.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));

    // Count add-ons nested under shown parents (matching the filter if active).
    const shownParentIds = new Set(shownParents.map((p) => p.id));
    let addonCount = 0;
    for (const [pid, addons] of allAddonsByParent) {
      if (!shownParentIds.has(pid)) continue;
      addonCount += filterActive ? addons.filter(matchesFilter).length : addons.length;
    }

    return { parentMods: shownParents, addonsByParent: allAddonsByParent, autoExpandIds, highlightAddonIds, addonCount };
  }, [visibleMods, sortedMods, filteredMods, matchesFilter, filters, activeProfileFilter]);

  // Keep the stable toggle callback reading the current auto-expand set.
  autoExpandRef.current = autoExpandIds;

  // A drawer is open if the user said so, else if search auto-expanded it.
  const isAddonsOpen = useCallback(
    (id: string) => addonOverrides.get(id) ?? autoExpandIds.has(id),
    [addonOverrides, autoExpandIds]
  );

  // New filter context, clean slate: drop manual open/close overrides so a
  // fresh search can auto-reveal again and stale opens don't linger.
  useEffect(() => {
    setAddonOverrides((prev) => (prev.size ? new Map() : prev));
  }, [filters.search, filters.category, filters.character, filters.showFavorites, activeProfileFilter]);

  // Library-at-a-glance stats (whole library, not the current filter).
  const libraryStats = useMemo(() => {
    const all = mods ?? [];
    const total = all.length;
    const enabled = all.filter((m) => m.enabled).length;
    const totalSize = all.reduce((s, m) => s + (m.fileSize || 0), 0);
    const charCounts = all.reduce<Record<string, number>>((acc, m) => {
      if (m.character && m.character !== 'All Characters') acc[m.character] = (acc[m.character] || 0) + 1;
      return acc;
    }, {});
    let topChar: string | null = null;
    let topCount = 0;
    for (const [ch, n] of Object.entries(charCounts)) {
      if (n > topCount) { topChar = ch; topCount = n; }
    }
    return { total, enabled, disabled: total - enabled, totalSize, topChar, topCount };
  }, [mods]);
  const headerTitle = filters.showFavorites
    ? 'Favorites'
    : filters.character
      ? filters.character
      : filters.category
        ? filters.category
        : filters.showEnabled && !filters.showDisabled
          ? 'Enabled'
          : filters.showDisabled && !filters.showEnabled
            ? 'Disabled'
            : 'All Mods';

  if (isLoading) {
    // Shimmer skeleton mirroring the card grid layout
    return (
      <div className="h-full flex flex-col" style={{ background: c.bg }}>
        <div className="flex items-baseline gap-3 px-[22px] pt-4 pb-1">
          <div className="skel" style={{ width: 230, height: 42, borderRadius: 10 }} />
          <div className="skel" style={{ width: 150, height: 14, borderRadius: 7 }} />
        </div>
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20, padding: '12px 22px 18px', alignContent: 'start', overflow: 'hidden', flex: 1 }}
        >
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} style={{ animation: `metadata-fade-in 400ms ease-out ${i * 55}ms both` }}>
              <div className="skel" style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 12 }} />
              <div className="flex items-center gap-2.5" style={{ marginTop: 10 }}>
                <div className="skel" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0 }} />
                <div className="flex-1">
                  <div className="skel" style={{ width: '72%', height: 13, borderRadius: 6 }} />
                  <div className="skel" style={{ width: '46%', height: 10, borderRadius: 5, marginTop: 6 }} />
                </div>
                <div className="skel" style={{ width: 44, height: 24, borderRadius: 999, flexShrink: 0 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: c.bg }}>
        <div style={{ color: c.err, fontFamily: c.font, fontSize: 16 }}>Error loading mods: {String(error)}</div>
      </div>
    );
  }

  const isGallery = viewMode === 'gallery';

  return (
    <>
      <div className="h-full flex flex-col" style={{ background: c.bg }}>
        {/* Gallery ribbon (replaces the sidebar in gallery mode) */}
        {isGallery && (
          <GalleryRibbon
            mods={visibleMods}
            filters={filters}
            setFilters={setFilters}
          />
        )}

        {/* Section header */}
        <div className="flex items-center gap-3 px-[22px] pt-4 pb-1">
          <div className="flex items-baseline gap-3 min-w-0">
            <h1 className="rivals-display" style={{ color: c.ink, fontSize: 40, fontWeight: 500, letterSpacing: '-0.02em' }}>
              {headerTitle}
            </h1>
            <span className="rivals-mono whitespace-nowrap" style={{ color: c.ink3, fontSize: 15 }}>
              {parentMods.length} shown{addonCount > 0 ? ` · ${addonCount} add-on${addonCount > 1 ? 's' : ''}` : ''}
            </span>
          </div>
          {/* Library-at-a-glance: one cohesive segmented bar (hidden when empty) */}
          {libraryStats.total > 0 && (
            <div className="ml-auto flex items-stretch flex-shrink-0 stat-strip">
              <div className="stat-seg" data-tip={`${libraryStats.enabled} enabled · ${libraryStats.disabled} disabled`}>
                <span className="stat-seg-bar">
                  <span className="stat-seg-bar-fill" style={{ width: `${(libraryStats.enabled / libraryStats.total) * 100}%` }} />
                </span>
                <span className="rivals-mono stat-seg-val">{libraryStats.enabled} / {libraryStats.total}</span>
                <span className="rivals-mono stat-seg-label">active</span>
              </div>
              <div className="stat-seg">
                <span className="rivals-mono stat-seg-val">{formatFileSize(libraryStats.totalSize)}</span>
                <span className="rivals-mono stat-seg-label">on disk</span>
              </div>
              {libraryStats.topChar && (
                <button
                  onClick={() => setFilters({ character: libraryStats.topChar as Character, category: null, showFavorites: false })}
                  className="stat-seg stat-seg-char cursor-pointer"
                  data-tip={`Most modded: ${libraryStats.topChar} (${libraryStats.topCount})`}
                >
                  <RingAvatar src={getCharacterIconPath(libraryStats.topChar)} alt={libraryStats.topChar} size={22} />
                  <span className="rivals-mono stat-seg-val">{libraryStats.topCount}</span>
                  <span className="rivals-mono stat-seg-label">top hero</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bulk action strip (Cards + Gallery only) */}
        {viewMode !== 'list' && parentMods.length > 0 && <BulkActionStrip />}

        {/* Content */}
        <div className={`flex-1 overflow-auto mod-list-scroll${isGallery ? ' gallery-scroll-fade' : ''}`}>
          <div key={viewMode} className="view-swap">
          {parentMods.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ paddingBottom: 48, animation: 'metadata-fade-in 350ms ease-out both' }}>
              <div
                className="grid place-items-center"
                style={{ width: 76, height: 76, borderRadius: 22, background: tint(c.accent, 10), border: `1px solid ${tint(c.accent, 28)}`, color: c.accent, marginBottom: 18 }}
              >
                {mods?.length === 0 ? <PackageOpen className="w-9 h-9" strokeWidth={1.5} /> : <SearchX className="w-9 h-9" strokeWidth={1.5} />}
              </div>
              <h3 className="rivals-display" style={{ color: c.ink2, fontSize: 25, fontWeight: 600, letterSpacing: '-0.01em' }}>
                {mods?.length === 0 ? 'Your library is empty' : 'Nothing matches'}
              </h3>
              <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 13.5, marginTop: 7 }}>
                {mods?.length === 0
                  ? 'Drag and drop mod files anywhere in this window to install them'
                  : 'Try clearing your search or switching filters'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20, padding: '12px 22px 18px', alignContent: 'start' }}
            >
              {parentMods.map((mod, index) => (
                <AnimatedCard key={mod.id} index={index}>
                  <ModCard
                    mod={mod}
                    allCostumes={allCostumes}
                    sortBy={sortBy}
                    addons={addonsByParent.get(mod.id)}
                    expanded={isAddonsOpen(mod.id)}
                    hasConflict={conflictIds.has(mod.id)}
                    highlightAddonIds={highlightAddonIds}
                    onToggleExpand={() => toggleExpand(mod.id)}
                    onClick={() => setSelectedModId(mod.id)}
                    onContextMenu={(e) => handleContextMenu(e, mod)}
                    onAddonClick={(addonId) => setSelectedModId(addonId)}
                    onAddonContextMenu={(e, addon) => handleContextMenu(e, addon)}
                  />
                </AnimatedCard>
              ))}
            </div>
          ) : viewMode === 'gallery' ? (
            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 24, padding: '14px 28px 22px', alignContent: 'start' }}
            >
              {parentMods.map((mod, index) => (
                <AnimatedCard key={mod.id} index={index}>
                  <GalleryCard
                    mod={mod}
                    allCostumes={allCostumes}
                    sortBy={sortBy}
                    addons={addonsByParent.get(mod.id)}
                    expanded={isAddonsOpen(mod.id)}
                    hasConflict={conflictIds.has(mod.id)}
                    highlightAddonIds={highlightAddonIds}
                    onToggleExpand={() => toggleExpand(mod.id)}
                    onClick={() => setSelectedModId(mod.id)}
                    onContextMenu={(e) => handleContextMenu(e, mod)}
                    onAddonClick={(addonId) => setSelectedModId(addonId)}
                    onAddonContextMenu={(e, addon) => handleContextMenu(e, addon)}
                  />
                </AnimatedCard>
              ))}
            </div>
          ) : (
            <ListView
              parentMods={parentMods}
              addonsByParent={addonsByParent}
              allCostumes={allCostumes}
              isAddonsOpen={isAddonsOpen}
              highlightAddonIds={highlightAddonIds}
              onToggleExpand={toggleExpand}
              onSelect={setSelectedModId}
              onContextMenu={handleContextMenu}
            />
          )}
          </div>
        </div>
      </div>

      {contextMenu && (
        <ModContextMenu mod={contextMenu.mod} x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} />
      )}
    </>
  );
}

// ── Enable / Disable pill (shared) ───────────────────────────────────────────
function EnablePill({ enabled, onClick }: { enabled: boolean; onClick: (e: React.MouseEvent) => void }) {
  // Pulse the pill the moment it flips to enabled ("powering on"). Driven
  // imperatively on the DOM node so we never setState during render.
  const btnRef = useRef<HTMLButtonElement>(null);
  const prevEnabled = useRef(enabled);
  useEffect(() => {
    if (enabled && !prevEnabled.current && btnRef.current) {
      const el = btnRef.current;
      el.classList.add('powering-on');
      const t = setTimeout(() => el.classList.remove('powering-on'), 520);
      prevEnabled.current = enabled;
      return () => clearTimeout(t);
    }
    prevEnabled.current = enabled;
  }, [enabled]);

  // A typographic "stamp" in the app's condensed face: state reads through the
  // fill and lettering (solid = live, hollow = off), with hover tinting toward
  // the action it would take (green = will enable, red = will disable).
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      className={`toggle-pill rivals-condensed cursor-pointer whitespace-nowrap ${enabled ? 'is-on' : 'is-off'}`}
      style={{
        padding: '3px 11px',
        borderRadius: 6,
        background: enabled ? tint(c.ok, 16) : 'transparent',
        color: enabled ? c.ok : c.ink3,
        border: `1px solid ${enabled ? tint(c.ok, 35) : c.line2}`,
        fontSize: 13.5,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        lineHeight: 1.45,
      }}
      data-tip={enabled ? 'Click to disable' : 'Click to enable'}
    >
      {enabled ? 'Enabled' : 'Disabled'}
    </button>
  );
}

// ── Add-on expand trigger (▸ +N) ─────────────────────────────────────────────
function AddonTrigger({ count, expanded, onClick }: { count: number; expanded: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      data-tip={`${count} attached add-on${count > 1 ? 's' : ''}`}
      className="addon-btn inline-flex items-center gap-1 cursor-pointer"
      style={{
        padding: '4px 8px',
        borderRadius: 6,
        background: expanded ? tint(c.warn, 14) : 'transparent',
        color: c.warn,
        border: `1px solid ${expanded ? tint(c.warn, 35) : c.line2}`,
        fontFamily: c.mono,
        fontSize: 10.5,
        letterSpacing: '0.04em',
      }}
    >
      <span style={{ fontSize: 9, transition: 'transform .15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▸</span>
      +{count}
    </button>
  );
}

// ── Replacement row (hero → costume/default) ─────────────────────────────────
function ReplacementRow({ mod, costume, layout }: { mod: ModInfo; costume: Costume | null; layout: 'split' | 'inline' }) {
  if (!mod.character) return null;
  const targetLabel = costume?.name ?? 'Default';

  if (layout === 'inline') {
    return (
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', background: c.bg, border: `1px solid ${c.line}`, borderRadius: 9, overflow: 'hidden' }}>
        {/* Character */}
        <div className="flex items-center gap-2.5 min-w-0" style={{ padding: '10px 12px', borderRight: `1px solid ${c.line}` }}>
          <RingAvatar src={getCharacterIconPath(mod.character)} alt={mod.character} size={44} />
          <div className="min-w-0">
            <div className="rivals-mono" style={{ color: c.ink3, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Character</div>
            <div className="truncate" style={{ color: c.ink, fontFamily: c.font, fontSize: 14, fontWeight: 600 }}>{mod.character}</div>
          </div>
        </div>
        {/* Costume */}
        <div className="flex items-center gap-2.5 min-w-0" style={{ padding: '10px 12px' }}>
          {costume ? (
            <RingAvatar src={getCostumeIconSrc(costume)} alt={costume.name} size={44} />
          ) : (
            <span className="flex-shrink-0" style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg, ${c.line2}, ${c.line})`, display: 'grid', placeItems: 'center', color: c.ink3, fontFamily: c.mono, fontSize: 14, fontWeight: 700 }}>—</span>
          )}
          <div className="min-w-0">
            <div className="rivals-mono" style={{ color: c.ink3, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Costume</div>
            <div className="truncate" style={{ color: c.ink2, fontFamily: c.font, fontSize: 13.5, fontWeight: costume ? 500 : 400, fontStyle: costume ? 'normal' : 'italic' }}>{targetLabel}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', background: c.bg, border: `1px solid ${c.line}`, borderRadius: 9, overflow: 'hidden' }}>
      <div className="flex items-center gap-2" style={{ padding: '8px 10px', borderRight: `1px solid ${c.line}` }}>
        <RingAvatar src={getCharacterIconPath(mod.character)} alt={mod.character} size={30} />
        <span className="truncate" style={{ color: c.ink, fontFamily: c.font, fontSize: 12.5, fontWeight: 600 }}>{mod.character}</span>
      </div>
      <div className="flex items-center gap-2" style={{ padding: '8px 10px' }}>
        {costume ? (
          <RingAvatar src={getCostumeIconSrc(costume)} alt={costume.name} size={30} />
        ) : (
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: `linear-gradient(135deg, ${c.line2}, ${c.line})`, display: 'grid', placeItems: 'center', color: c.ink3, fontFamily: c.mono, fontSize: 11, fontWeight: 700, flex: '0 0 auto' }}>—</span>
        )}
        <span className="truncate" style={{ color: c.ink2, fontFamily: c.font, fontSize: 12.5, fontStyle: costume ? 'normal' : 'italic' }}>{targetLabel}</span>
      </div>
    </div>
  );
}

interface CardProps {
  mod: ModInfo;
  allCostumes: Record<string, Costume[]> | undefined;
  sortBy: string;
  addons?: ModInfo[];
  expanded: boolean;
  hasConflict?: boolean;
  highlightAddonIds?: Set<string>;
  onToggleExpand: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onAddonClick: (addonId: string) => void;
  onAddonContextMenu: (e: React.MouseEvent, addon: ModInfo) => void;
}

// ── Inline add-on rows (Cards + Gallery views) ───────────────────────────────
// `overlay` renders the rows bare (no header or background chrome) for use
// inside the AddonDrawer, which supplies its own header and translucent surface.
function AddonRows({
  parentEnabled,
  parentName,
  addons,
  highlightAddonIds,
  onAddonClick,
  onAddonContextMenu,
  large,
  overlay,
}: {
  parentEnabled: boolean;
  parentName?: string;
  addons: ModInfo[];
  highlightAddonIds?: Set<string>;
  onAddonClick: (id: string) => void;
  onAddonContextMenu: (e: React.MouseEvent, addon: ModInfo) => void;
  large?: boolean;
  overlay?: boolean;
}) {
  const toggleEnabled = useToggleModEnabled();
  const thumbW = large ? 72 : 56;
  const thumbH = large ? 41 : 32;
  const rowPad = large ? '11px 16px 11px 20px' : '8px 12px 8px 16px';
  const titleSize = large ? 14 : 12.5;
  return (
    <div style={{ background: overlay ? 'transparent' : c.bg, borderTop: overlay ? 'none' : `1px solid ${c.line}`, position: 'relative' }}>
      {!overlay && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: tint(c.warn, 55) }} />}
      {!overlay && (
        <div className="flex items-center gap-2" style={{ padding: large ? '11px 16px 7px 20px' : '8px 12px 6px 16px' }}>
          <PlusIcon stroke={c.warn} />
          <span style={{ color: c.warn, fontFamily: c.mono, fontSize: large ? 11 : 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
            {addons.length} Add-on{addons.length > 1 ? 's' : ''}
          </span>
          <span style={{ flex: 1, height: 1, background: c.line, marginTop: 2 }} />
        </div>
      )}
      <div className="flex flex-col">
        {addons.map((addon, ai) => {
          const hl = highlightAddonIds?.has(addon.id);
          const hlColor = categoryColor(addon.category);
          return (
          <div
            key={addon.id}
            onClick={(e) => { e.stopPropagation(); onAddonClick(addon.id); }}
            onContextMenu={(e) => { e.stopPropagation(); onAddonContextMenu(e, addon); }}
            className={`addon-row flex items-center gap-2.5 cursor-pointer transition-colors ${hl ? 'addon-hl' : ''}`}
            style={{
              padding: rowPad,
              borderTop: ai > 0 ? `1px solid ${c.line}` : 'none',
              ['--hl-color' as string]: hlColor,
            }}
            onMouseEnter={(e) => { if (!hl) e.currentTarget.style.background = tint(c.warn, 8); }}
            onMouseLeave={(e) => { if (!hl) e.currentTarget.style.background = 'transparent'; }}
          >
            {addon.thumbnailPath ? (
              <img src={convertFileSrc(addon.thumbnailPath)} alt="" loading="lazy" style={{ width: thumbW, height: thumbH, borderRadius: 5, objectFit: 'cover', border: `1px solid ${c.line2}`, flex: '0 0 auto' }} />
            ) : (
              <span style={{ width: thumbW, height: thumbH, borderRadius: 5, border: `1px solid ${c.line2}`, display: 'grid', placeItems: 'center', color: c.ink3, flex: '0 0 auto' }}>+</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate" style={{ color: c.ink, fontFamily: c.font, fontSize: titleSize, fontWeight: 600 }}>{addonDisplayName(addon.metadata.title || addon.name, parentName)}</div>
              <div className="flex items-center gap-1.5" style={{ color: c.ink3, fontFamily: c.font, fontSize: 11, marginTop: 2 }}>
                <MiniCatPill category={addon.category} />
                <span>{formatFileSize(addon.fileSize)}</span>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); if (parentEnabled) toggleEnabled.mutate(addon.id); }}
              disabled={!parentEnabled}
              data-tip={!parentEnabled ? 'Enable parent mod first' : undefined}
              className={`toggle-pill ${addon.enabled && parentEnabled ? 'is-on' : 'is-off'}`}
              style={{
                padding: '3px 9px',
                borderRadius: 5,
                background: addon.enabled && parentEnabled ? tint(c.ok, 16) : 'transparent',
                color: addon.enabled && parentEnabled ? c.ok : parentEnabled ? c.ink3 : c.muted,
                border: `1px solid ${addon.enabled && parentEnabled ? tint(c.ok, 35) : c.line2}`,
                fontFamily: c.mono,
                fontSize: 10,
                letterSpacing: '0.08em',
                cursor: parentEnabled ? 'pointer' : 'not-allowed',
                opacity: parentEnabled ? 1 : 0.5,
              }}
            >
              {addon.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Add-on drawer ─────────────────────────────────────────────────────────────
// Slides up OVER the card's artwork instead of growing the card, so every card
// keeps the same height and grid rows stay aligned no matter who has add-ons.
function AddonDrawer({ open, count, onClose, children }: { open: boolean; count: number; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col"
      onClick={(e) => e.stopPropagation()}
      aria-hidden={!open}
      style={{
        transform: open ? 'translateY(0)' : 'translateY(103%)',
        transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: open ? 'auto' : 'none',
        background: 'color-mix(in oklch, var(--rivals-bg) 90%, transparent)',
        backdropFilter: 'blur(8px)',
        boxShadow: `inset 0 1px 0 ${tint(c.warn, 30)}`,
      }}
    >
      <div className="flex items-center gap-2" style={{ padding: '9px 10px 8px 16px', borderBottom: `1px solid ${c.line}`, flex: '0 0 auto' }}>
        <PlusIcon stroke={c.warn} />
        <span style={{ color: c.warn, fontFamily: c.mono, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
          {count} Add-on{count > 1 ? 's' : ''}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="fav-btn grid place-items-center cursor-pointer"
          data-tip="Close add-ons"
          aria-label="Close add-ons"
          style={{ marginLeft: 'auto', width: 26, height: 26, borderRadius: 6, color: c.ink3, background: 'transparent', border: 'none', fontSize: 16, lineHeight: 1 }}
        >
          ×
        </button>
      </div>
      <div className="mod-list-scroll" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

// ── CARDS VIEW ───────────────────────────────────────────────────────────────
const ModCard = memo(function ModCard({
  mod,
  allCostumes,
  sortBy,
  addons,
  expanded,
  hasConflict,
  highlightAddonIds,
  onToggleExpand,
  onClick,
  onContextMenu,
  onAddonClick,
  onAddonContextMenu,
}: CardProps) {
  const toggleEnabled = useToggleModEnabled();
  const toggleFavorite = useToggleFavorite();
  const costume = getCostumeForMod(mod, allCostumes);
  const thumb = getThumbnailSrc(mod);
  const glow = useDominantColor(thumb);
  const tiltRef = useCardTilt();
  const { main, variant } = parseTitleParts(mod.metadata.title || mod.name);
  const dateStr = sortBy === 'updated' ? new Date(mod.lastModified).toLocaleDateString() : new Date(mod.installDate).toLocaleDateString();
  const addonList = addons ?? [];
  const hasAddons = addonList.length > 0;

  return (
    <div
      ref={tiltRef}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="mod-card mod-card-tilt flex flex-col overflow-hidden cursor-pointer"
      style={{ background: c.panel, border: `1px solid ${c.line}`, borderRadius: 14, opacity: mod.enabled ? 1 : 0.55, ['--glow-color' as string]: glow ?? c.accent }}
    >
      {/* Image (also hosts the add-on drawer so the card never grows) */}
      <div className="relative" style={{ aspectRatio: '16/9', background: c.bg, overflow: 'hidden' }}>
        {thumb ? (
          <img src={thumb} alt={mod.name} loading="lazy" className="mod-card-img w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center" style={{ color: c.muted, fontFamily: c.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            no preview
          </div>
        )}
        {hasAddons && (
          <AddonDrawer open={expanded} count={addonList.length} onClose={onToggleExpand}>
            <AddonRows overlay parentEnabled={mod.enabled} parentName={mod.metadata.title || mod.name} addons={addonList} highlightAddonIds={highlightAddonIds} onAddonClick={onAddonClick} onAddonContextMenu={onAddonContextMenu} />
          </AddonDrawer>
        )}
      </div>

      <div className="flex flex-col gap-2.5" style={{ padding: '14px 16px 16px' }}>
        {/* Pill row */}
        <div className="flex items-center gap-1.5">
          <CategoryPill category={mod.category} size="lg" />
          {mod.metadata.isNsfw && <NsfwPill size="lg" />}
          {hasConflict && <ConflictPill size="lg" />}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite.mutate(mod.id); }}
            className="fav-btn grid place-items-center cursor-pointer"
            style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: 7, background: 'transparent', color: mod.isFavorite ? c.warn : c.ink3, fontSize: 17, lineHeight: 1 }}
            data-tip={mod.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={mod.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {mod.isFavorite ? '★' : '☆'}
          </button>
        </div>

        {/* Title */}
        <div className="rivals-condensed" style={{ color: c.ink, fontSize: 30, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.05, textTransform: 'uppercase' }}>
          {main}
        </div>
        <div style={{ marginTop: -8 }}>
          <Subtitle variant={variant} subtitle={mod.metadata.subtitle} fontSize={13} />
        </div>

        {/* Replacement */}
        <ReplacementRow mod={mod} costume={costume} layout="split" />

        {/* Footer */}
        <div className="flex items-center gap-2" style={{ paddingTop: 10, marginTop: 2, borderTop: `1px solid ${c.line}` }}>
          <span style={{ color: c.ink3, fontFamily: c.font, fontSize: 12.5 }} className="truncate">
            By <span style={{ color: c.ink2, fontWeight: 500 }}>{mod.metadata.author || 'Unknown'}</span>
            <span style={{ color: c.muted }}> · </span>
            {formatFileSize(mod.fileSize)}
            <span style={{ color: c.muted }}> · </span>
            {dateStr}
          </span>
          <div className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
            {hasAddons && <AddonTrigger count={addonList.length} expanded={expanded} onClick={(e) => { e.stopPropagation(); onToggleExpand(); }} />}
            <EnablePill enabled={mod.enabled} onClick={(e) => { e.stopPropagation(); toggleEnabled.mutate(mod.id); }} />
          </div>
        </div>
      </div>

    </div>
  );
});

// ── GALLERY VIEW ─────────────────────────────────────────────────────────────
const GalleryCard = memo(function GalleryCard({
  mod,
  allCostumes,
  sortBy,
  addons,
  expanded,
  hasConflict,
  highlightAddonIds,
  onToggleExpand,
  onClick,
  onContextMenu,
  onAddonClick,
  onAddonContextMenu,
}: CardProps) {
  const toggleEnabled = useToggleModEnabled();
  const toggleFavorite = useToggleFavorite();
  const costume = getCostumeForMod(mod, allCostumes);
  const thumb = getThumbnailSrc(mod);
  const glow = useDominantColor(thumb);
  const tiltRef = useCardTilt();
  const { main, variant } = parseTitleParts(mod.metadata.title || mod.name);
  const dateStr = sortBy === 'updated' ? new Date(mod.lastModified).toLocaleDateString() : new Date(mod.installDate).toLocaleDateString();
  const addonList = addons ?? [];
  const hasAddons = addonList.length > 0;

  return (
    <div
      ref={tiltRef}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="mod-card mod-card-tilt gallery-hero flex flex-col overflow-hidden cursor-pointer relative"
      style={{ background: c.panel, border: `1px solid ${c.line}`, borderRadius: 14, ['--glow-color' as string]: glow ?? c.accent }}
    >
      {/* Full-bleed artwork with overlaid title + meta. The art box owns the
          top rounding + clip so the hover zoom never pokes square corners
          through during the transform (a GPU-layer clipping quirk). */}
      <div className="gallery-hero-art relative" style={{ aspectRatio: '16/10', background: c.bg, overflow: 'hidden', borderRadius: '13px 13px 0 0' }}>
        {thumb ? (
          <img src={thumb} alt={mod.name} loading="lazy" className="mod-card-img w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center" style={{ color: c.muted, fontFamily: c.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            no preview
          </div>
        )}

        {/* Scrim so overlaid text stays readable over any art */}
        <div className="gallery-hero-scrim" aria-hidden />

        {/* Favorite only on the art (its glass background keeps it readable);
            category/NSFW/version pills live in the body where they're always
            legible against the solid panel, not over busy artwork. */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite.mutate(mod.id); }}
          className="fav-btn absolute z-10 grid place-items-center cursor-pointer"
          style={{ top: 12, right: 14, width: 30, height: 30, borderRadius: 8, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)', color: mod.isFavorite ? c.warn : '#fff', fontSize: 18, lineHeight: 1 }}
          data-tip={mod.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={mod.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {mod.isFavorite ? '★' : '☆'}
        </button>

        {/* Title + author overlaid at the bottom of the art */}
        <div className="absolute inset-x-0 bottom-0 z-10" style={{ padding: '0 18px 16px' }}>
          <div className="rivals-condensed gallery-hero-title" style={{ fontSize: 40, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 0.98, textTransform: 'uppercase' }}>
            {main}
          </div>
          <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 6 }}>
            <Subtitle variant={variant} subtitle={mod.metadata.subtitle} fontSize={13.5} />
            {(variant || mod.metadata.subtitle) && <span style={{ color: 'rgba(255,255,255,0.4)' }}>·</span>}
            <span className="gallery-hero-by" style={{ fontFamily: c.font, fontSize: 12.5 }}>
              by <span style={{ fontWeight: 600 }}>{mod.metadata.author || 'Unknown'}</span>
            </span>
          </div>
        </div>

        {/* Add-on drawer over the art — the card never changes height */}
        {hasAddons && (
          <AddonDrawer open={expanded} count={addonList.length} onClose={onToggleExpand}>
            <AddonRows overlay large parentEnabled={mod.enabled} parentName={mod.metadata.title || mod.name} addons={addonList} highlightAddonIds={highlightAddonIds} onAddonClick={onAddonClick} onAddonContextMenu={onAddonContextMenu} />
          </AddonDrawer>
        )}
      </div>

      <div className="flex flex-col gap-3.5" style={{ padding: '14px 20px 18px' }}>
        {/* Tag row (moved off the art for legibility) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <CategoryPill category={mod.category} size="lg" />
          {mod.metadata.isNsfw && <NsfwPill size="lg" />}
          {hasConflict && <ConflictPill size="lg" />}
          {mod.metadata.version && (
            <span style={{ color: c.ink3, fontFamily: c.mono, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              v{mod.metadata.version}
            </span>
          )}
        </div>

        {/* Replacement */}
        <ReplacementRow mod={mod} costume={costume} layout="inline" />

        {/* Enable row */}
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); toggleEnabled.mutate(mod.id); }}
            className={`enable-btn flex-1 cursor-pointer rivals-condensed ${mod.enabled ? '' : 'is-off'}`}
            style={{
              padding: '6px 0',
              background: mod.enabled ? c.accent : 'transparent',
              color: mod.enabled ? c.onAccent : c.ink,
              border: `1px solid ${mod.enabled ? c.accent : c.line2}`,
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 12.5,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {mod.enabled ? '● Enabled' : '○ Enable'}
          </button>
          {hasAddons && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              data-tip={`${addonList.length} attached add-on${addonList.length > 1 ? 's' : ''}`}
              className="addon-btn inline-flex items-center gap-1.5 cursor-pointer"
              style={{ height: 29, padding: '0 10px', borderRadius: 8, background: expanded ? tint(c.warn, 14) : 'transparent', color: c.warn, border: `1px solid ${expanded ? tint(c.warn, 55) : c.line2}`, fontFamily: c.mono, fontSize: 11, letterSpacing: '0.04em' }}
            >
              <span style={{ fontSize: 9, transition: 'transform .15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▸</span>
              +{addonList.length}
            </button>
          )}
        </div>

        {/* Footer meta — size · date (readable) */}
        <div className="flex items-center gap-2" style={{ paddingTop: 4, fontFamily: c.mono, fontSize: 12 }}>
          <span style={{ color: c.ink2 }}>{formatFileSize(mod.fileSize)}</span>
          <span style={{ color: c.muted }}>·</span>
          <span style={{ color: c.ink3 }}>{dateStr}</span>
        </div>

      </div>
    </div>
  );
});


// ── LIST VIEW ────────────────────────────────────────────────────────────────
const COL_TPL = '18px 60px 28px 1fr 130px 90px 110px 80px 100px';

function ListView({
  parentMods,
  addonsByParent,
  allCostumes,
  isAddonsOpen,
  highlightAddonIds,
  onToggleExpand,
  onSelect,
  onContextMenu,
}: {
  parentMods: ModInfo[];
  addonsByParent: Map<string, ModInfo[]>;
  allCostumes: Record<string, Costume[]> | undefined;
  isAddonsOpen: (id: string) => boolean;
  highlightAddonIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, mod: ModInfo) => void;
}) {
  // Group by character (preserving the sorted order of first appearance).
  const groups = useMemo(() => {
    const map = new Map<string, ModInfo[]>();
    for (const mod of parentMods) {
      const key = mod.character || 'Unassigned';
      const arr = map.get(key) || [];
      arr.push(mod);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [parentMods]);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div
        className="grid sticky top-0 z-[1]"
        style={{ gridTemplateColumns: COL_TPL, gap: 10, padding: '8px 22px', background: c.panel, borderBottom: `1px solid ${c.line2}`, color: c.ink3, fontFamily: c.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', alignItems: 'center' }}
      >
        <span />
        <span />
        <span style={{ textAlign: 'right' }}>#</span>
        <span>Title / Tag</span>
        <span>Costume</span>
        <span>Type</span>
        <span>Author</span>
        <span style={{ textAlign: 'right' }}>Size</span>
        <span>State</span>
      </div>

      {groups.map(([groupName, list]) => {
        const active = list.filter((m) => m.enabled).length;
        return (
          <div key={groupName}>
            {/* Group header */}
            <div className="flex items-center gap-2.5" style={{ padding: '10px 22px 6px', background: c.panelHi, borderTop: `1px solid ${c.line}`, borderBottom: `1px solid ${c.line}` }}>
              <HeroChip name={groupName} size={20} />
              <span style={{ color: c.ink, fontFamily: c.display, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>{groupName}</span>
              <span style={{ color: c.ink3, fontFamily: c.mono, fontSize: 10.5 }}>· {list.length} mods · {active} active</span>
            </div>

            {list.map((mod, idx) => (
              <ListRow
                key={mod.id}
                mod={mod}
                idx={idx}
                allCostumes={allCostumes}
                addons={addonsByParent.get(mod.id)}
                expanded={isAddonsOpen(mod.id)}
                highlightAddonIds={highlightAddonIds}
                onToggleExpand={() => onToggleExpand(mod.id)}
                onSelect={() => onSelect(mod.id)}
                onContextMenu={(e) => onContextMenu(e, mod)}
                onAddonSelect={onSelect}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

const ListRow = memo(function ListRow({
  mod,
  idx,
  allCostumes,
  addons,
  expanded,
  highlightAddonIds,
  onToggleExpand,
  onSelect,
  onContextMenu,
  onAddonSelect,
}: {
  mod: ModInfo;
  idx: number;
  allCostumes: Record<string, Costume[]> | undefined;
  addons?: ModInfo[];
  expanded: boolean;
  highlightAddonIds?: Set<string>;
  onToggleExpand: () => void;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onAddonSelect: (id: string) => void;
}) {
  const toggleEnabled = useToggleModEnabled();
  const costume = getCostumeForMod(mod, allCostumes);
  const thumb = getThumbnailSrc(mod);
  const addonList = addons ?? [];
  const hasAddons = addonList.length > 0;
  const stripeBg = idx % 2 === 0 ? 'transparent' : c.panel;

  return (
    <>
      <div
        onClick={onSelect}
        onContextMenu={onContextMenu}
        className="list-row grid cursor-pointer"
        style={{ gridTemplateColumns: COL_TPL, gap: 10, padding: '7px 22px', background: stripeBg, borderBottom: expanded ? 'none' : `1px solid ${c.line}`, color: c.ink2, fontFamily: c.mono, fontSize: 11.5, alignItems: 'center', opacity: mod.enabled ? 1 : 0.6 }}
      >
        <span style={{ color: c.muted, cursor: 'grab', textAlign: 'center' }} data-tip="Drag to reorder (visual)">⋮⋮</span>
        <div style={{ width: 60, height: 34, overflow: 'hidden', border: `1px solid ${c.line2}`, borderRadius: 3, background: c.bg }}>
          {thumb && <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />}
        </div>
        <span style={{ color: c.ink3, textAlign: 'right' }}>{String(idx + 1).padStart(3, '0')}</span>
        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ color: c.ink, fontFamily: c.font, fontWeight: 600, fontSize: 12.5 }} className="truncate">{mod.metadata.title || mod.name}</span>
            {mod.metadata.isNsfw && (
              <span style={{ padding: '2px 8px', borderRadius: 999, background: 'transparent', color: c.nsfw, border: `1px solid ${tint(c.nsfw, 55)}`, fontFamily: c.mono, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>nsfw</span>
            )}
            {hasAddons && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                style={{ padding: '2px 8px', borderRadius: 999, background: expanded ? tint(c.warn, 25) : tint(c.warn, 14), color: c.warn, border: `1px solid ${expanded ? tint(c.warn, 60) : tint(c.warn, 35)}`, fontFamily: c.mono, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 8, transition: 'transform .15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', marginRight: 3 }}>▸</span>
                +{addonList.length} add-on{addonList.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
          {mod.metadata.tags && mod.metadata.tags.length > 0 && (
            <span style={{ color: c.ink3, fontSize: 10.5 }} className="truncate">{mod.metadata.tags.join(' · ')}</span>
          )}
        </div>
        <span className="truncate" style={{ color: c.ink2 }}>{costume?.name ?? (mod.character ? 'Default' : '—')}</span>
        <span style={{ color: c.ink2, fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{mod.category}</span>
        <span className="truncate" style={{ color: c.ink2 }}>{mod.metadata.author || 'Unknown'}</span>
        <span style={{ color: c.ink3, textAlign: 'right' }}>{formatFileSize(mod.fileSize)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); toggleEnabled.mutate(mod.id); }}
          className="flex items-center gap-1.5 cursor-pointer"
          style={{ padding: '3px 8px', background: mod.enabled ? tint(c.ok, 13) : 'transparent', color: mod.enabled ? c.ok : c.ink3, border: `1px solid ${mod.enabled ? tint(c.ok, 25) : c.line2}`, borderRadius: 4, fontFamily: c.mono, fontSize: 10, letterSpacing: '0.06em' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: mod.enabled ? c.ok : c.muted, boxShadow: mod.enabled ? `0 0 6px ${tint(c.ok, 90)}` : 'none' }} />
          {mod.enabled ? 'ACTIVE' : 'OFF'}
        </button>
      </div>

      {expanded && hasAddons && (
        <div style={{ padding: '6px 22px 10px 22px', background: idx % 2 === 0 ? c.bg : c.panel, borderBottom: `1px solid ${c.line}`, borderLeft: `3px solid ${c.warn}` }} className="flex flex-col gap-1">
          <div style={{ padding: '0 0 4px 60px', color: c.warn, fontFamily: c.mono, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
            ↳ {addonList.length} attached add-on{addonList.length > 1 ? 's' : ''}
          </div>
          {addonList.map((a) => {
            const on = a.enabled && mod.enabled;
            const hl = highlightAddonIds?.has(a.id);
            const hlColor = categoryColor(a.category);
            return (
              <div
                key={a.id}
                onClick={(e) => { e.stopPropagation(); onAddonSelect(a.id); }}
                className={`grid cursor-pointer ${hl ? 'addon-hl' : ''}`}
                style={{ gridTemplateColumns: '60px 28px 1fr 110px 80px 100px', gap: 10, padding: '4px 6px 4px 60px', alignItems: 'center', color: c.ink3, fontFamily: c.mono, fontSize: 11, borderRadius: 5, ['--hl-color' as string]: hlColor }}
              >
                <div style={{ width: 38, height: 24, overflow: 'hidden', border: `1px solid ${c.line2}`, borderRadius: 3, background: c.bg }}>
                  {a.thumbnailPath && <img src={convertFileSrc(a.thumbnailPath)} alt="" loading="lazy" className="w-full h-full object-cover" />}
                </div>
                <span style={{ color: c.muted, fontSize: 10 }}>↳</span>
                <span className="truncate" style={{ color: mod.enabled ? c.ink : c.muted, fontFamily: c.font, fontSize: 12, fontWeight: 500 }}>{addonDisplayName(a.metadata.title || a.name, mod.metadata.title || mod.name)}</span>
                <span><MiniCatPill category={a.category} /></span>
                <span style={{ color: c.ink3, textAlign: 'right' }}>{formatFileSize(a.fileSize)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); if (mod.enabled) toggleEnabled.mutate(a.id); }}
                  disabled={!mod.enabled}
                  className="flex items-center gap-1.5"
                  style={{ padding: '3px 8px', background: on ? tint(c.ok, 13) : 'transparent', color: on ? c.ok : mod.enabled ? c.ink3 : c.muted, border: `1px solid ${on ? tint(c.ok, 25) : c.line2}`, borderRadius: 4, fontFamily: c.mono, fontSize: 10, letterSpacing: '0.06em', cursor: mod.enabled ? 'pointer' : 'not-allowed', opacity: mod.enabled ? 1 : 0.5 }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? c.ok : c.muted, boxShadow: on ? `0 0 6px ${tint(c.ok, 90)}` : 'none' }} />
                  {a.enabled ? 'ACTIVE' : 'OFF'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
});

// ── GALLERY RIBBON (sidebar replacement in gallery mode) ─────────────────────
function GalleryRibbon({
  mods,
  filters,
  setFilters,
}: {
  mods: ModInfo[];
  filters: { category: ModCategory | null; character: Character | null; showFavorites: boolean };
  setFilters: (f: Partial<{ category: ModCategory | null; character: Character | null; showFavorites: boolean }>) => void;
}) {
  // Per-character counts for the rail.
  const charCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const mod of mods) {
      if (mod.character && mod.character !== 'All Characters') m[mod.character] = (m[mod.character] || 0) + 1;
    }
    return m;
  }, [mods]);

  // Per-category counts for the category buttons.
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const mod of mods) m[mod.category] = (m[mod.category] || 0) + 1;
    return m;
  }, [mods]);

  const railChars = ALL_CHARACTERS.filter((ch) => ch !== 'All Characters' && (charCounts[ch] || 0) > 0);
  const CATS: ModCategory[] = ['Skins', 'Audio', 'UI', 'Gameplay'];

  const railRef = useRef<HTMLDivElement>(null);
  // Vertical wheel → fast horizontal scroll. Direct jump (CSS scroll-behavior:
  // smooth on .gallery-rail keeps it from looking jumpy) with a big multiplier.
  const onRailWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = railRef.current;
    if (!el) return;
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    if (delta === 0) return;
    el.scrollBy({ left: delta * 4, behavior: 'smooth' });
  }, []);

  const allActive = !filters.showFavorites && filters.category === null && filters.character === null;

  return (
    <div className="flex flex-col gap-2.5" style={{ margin: '14px 28px 0', padding: '12px 16px', background: c.panel, border: `1px solid ${c.line}`, borderRadius: 12 }}>
      {/* Row 1: quick filters + categories */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilters({ showFavorites: false, category: null, character: null })}
          style={{ padding: '6px 12px', borderRadius: 7, background: allActive ? c.panelHi : 'transparent', color: allActive ? c.ink : c.ink2, border: `1px solid ${allActive ? c.line2 : 'transparent'}`, boxShadow: allActive ? `inset 0 -2px 0 ${c.accent}` : 'none', fontFamily: c.font, fontSize: 12.5, fontWeight: allActive ? 600 : 400, cursor: 'pointer' }}
        >
          All Mods
        </button>
        <button
          onClick={() => setFilters({ showFavorites: true, category: null, character: null })}
          style={{ padding: '6px 12px', borderRadius: 7, background: filters.showFavorites ? c.panelHi : 'transparent', color: filters.showFavorites ? c.ink : c.ink2, border: `1px solid ${filters.showFavorites ? c.line2 : 'transparent'}`, boxShadow: filters.showFavorites ? `inset 0 -2px 0 ${c.accent}` : 'none', fontFamily: c.font, fontSize: 12.5, fontWeight: filters.showFavorites ? 600 : 400, cursor: 'pointer' }}
        >
          Favorites
        </button>

        <span style={{ width: 1, height: 20, background: c.line, margin: '0 2px' }} />

        {CATS.map((cat) => {
          const active = filters.category === cat;
          const col = categoryColor(cat);
          return (
            <button
              key={cat}
              onClick={() => setFilters({ category: active ? null : cat, character: null, showFavorites: false })}
              className="inline-flex items-center gap-1.5"
              style={{ padding: '6px 11px', borderRadius: 7, background: active ? tint(col, 16) : 'transparent', color: active ? col : c.ink2, border: `1px solid ${active ? tint(col, 50) : c.line2}`, fontFamily: c.font, fontSize: 12.5, fontWeight: active ? 600 : 400, cursor: 'pointer' }}
            >
              <CategoryIcon category={cat} stroke={active ? col : c.ink3} size={11} />
              {cat}
              <span style={{ color: active ? col : c.muted, fontFamily: c.mono, fontSize: 10.5 }}>{catCounts[cat] || 0}</span>
            </button>
          );
        })}
      </div>

      {/* Row 2: character rail — wheel scrolls horizontally, accent scrollbar */}
      <div
        ref={railRef}
        onWheel={onRailWheel}
        className="gallery-rail flex items-center gap-1.5 overflow-x-auto overflow-y-visible"
        style={{ paddingTop: 8, paddingBottom: 8 }}
      >
        <button
          onClick={() => setFilters({ character: null })}
          className="flex items-center gap-1.5 flex-shrink-0"
          style={{ padding: '4px 10px 4px 6px', borderRadius: 999, background: !filters.character ? c.accent : 'transparent', color: !filters.character ? c.onAccent : c.ink2, border: `1px solid ${!filters.character ? c.accent : c.line2}`, fontFamily: c.font, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          <span style={{ width: 18, height: 18, borderRadius: '50%', background: !filters.character ? c.onAccent : c.line, color: !filters.character ? c.accent : c.ink3, display: 'grid', placeItems: 'center', fontFamily: c.mono, fontSize: 10, fontWeight: 700 }}>∗</span>
          All
        </button>
        {railChars.map((ch) => {
          const active = filters.character === ch;
          return (
            <button
              key={ch}
              onClick={() => setFilters({ character: active ? null : ch, category: null, showFavorites: false })}
              className={`gallery-pill flex items-center gap-1.5 flex-shrink-0 ${active ? 'is-active' : ''}`}
              style={{ padding: '4px 11px 4px 4px', borderRadius: 999, background: active ? c.panelHi : 'transparent', color: active ? c.ink : c.ink2, border: `1px solid ${active ? c.accent : c.line2}`, fontFamily: c.font, fontSize: 12, cursor: 'pointer' }}
            >
              <RingAvatar src={getCharacterIconPath(ch)} alt={ch} size={24} />
              <span style={{ fontWeight: active ? 600 : 500 }}>{ch}</span>
              <span style={{ color: c.ink3, fontFamily: c.mono, fontSize: 10 }}>{charCounts[ch]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
