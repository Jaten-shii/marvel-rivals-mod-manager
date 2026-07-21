import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PackageOpen, SearchX } from 'lucide-react';
import { useGetMods, useGetAllCostumes, useToggleModEnabled, useToggleFavorite, useModConflicts, useSetModsEnabled, useDeleteMods } from '../hooks/useMods';
import { useUIStore } from '../stores';
import type { ModInfo, Costume, ModCategory, Character } from '../types/mod.types';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ModContextMenu } from './ModContextMenu';
import { BulkActionStrip } from './BulkActionStrip';
import { ALL_CHARACTERS } from '../shared/constants';
import { c, tint, categoryColor, parseTitleParts, formatFileSize, getCharacterIconPath, getCostumeIconSrc, addonDisplayName, withViewTransition } from '../shared/rivals-tokens';
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

// Memoized cell for the virtualized grid. The per-mod click closures live
// INSIDE this memo boundary and the parent passes only stable handlers, so
// already-mounted cards skip re-rendering entirely while the virtualizer
// updates on every scroll tick. No entrance animation: rows scrolling back
// into view should look like they were always there, not fade in again.
const VirtualModCard = memo(function VirtualModCard({
  mod,
  allCostumes,
  sortBy,
  addons,
  expanded,
  hasConflict,
  selected,
  highlightAddonIds,
  onToggleExpand,
  onSelect,
  onCardContextMenu,
}: {
  mod: ModInfo;
  allCostumes: Record<string, Costume[]> | undefined;
  sortBy: string;
  addons?: ModInfo[];
  expanded: boolean;
  hasConflict: boolean;
  selected: boolean;
  highlightAddonIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string, additive?: boolean) => void;
  onCardContextMenu: (e: React.MouseEvent, mod: ModInfo) => void;
}) {
  return (
    <div className="self-start">
      <ModCard
        mod={mod}
        allCostumes={allCostumes}
        sortBy={sortBy}
        addons={addons}
        expanded={expanded}
        hasConflict={hasConflict}
        selected={selected}
        highlightAddonIds={highlightAddonIds}
        onToggleExpand={() => onToggleExpand(mod.id)}
        onClick={(e) => onSelect(mod.id, e.ctrlKey || e.metaKey)}
        onContextMenu={(e) => onCardContextMenu(e, mod)}
        onAddonClick={(addonId) => onSelect(addonId)}
        onAddonContextMenu={(e, addon) => onCardContextMenu(e, addon)}
      />
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

// ── Kicker tag (cards view) ──────────────────────────────────────────────────
// Custom icon + letterspaced condensed caps — replaces pill bubbles so the
// card reads like a poster credit block instead of a form.
function KickerTag({ color, label, icon, tip, size }: { color: string; label: string; icon?: React.ReactNode; tip?: string; size?: number }) {
  return (
    <span className="kicker-tag rivals-condensed" style={{ color, ...(size ? { fontSize: size, gap: 4 } : {}) }} data-tip={tip}>
      {icon ?? <span className="kicker-notch" style={{ background: color }} />}
      {label}
    </span>
  );
}

// Boxless enable state for dense rows (list + add-on rows): dot + word only.
function MiniPower({ on, disabled, label, onClick, tip }: { on: boolean; disabled?: boolean; label: string; onClick: (e: React.MouseEvent) => void; tip?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-tip={tip}
      className="rivals-mono inline-flex items-center gap-1.5"
      style={{
        padding: '3px 4px',
        background: 'transparent',
        border: 'none',
        color: on ? c.ok : disabled ? c.muted : c.ink3,
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: on ? c.ok : 'transparent', boxShadow: on ? `0 0 6px ${tint(c.ok, 90)}` : `inset 0 0 0 1.5px ${disabled ? c.muted : c.ink3}` }} />
      {label}
    </button>
  );
}

// ── Power readout (cards view enable control) ────────────────────────────────
// Glowing status dot + state word, no box. Hover previews the action color.
function PowerToggle({ enabled, onClick }: { enabled: boolean; onClick: (e: React.MouseEvent) => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const prevEnabled = useRef(enabled);
  useEffect(() => {
    if (enabled && !prevEnabled.current && btnRef.current) {
      const el = btnRef.current;
      el.classList.add('powering-on');
      const t = setTimeout(() => el.classList.remove('powering-on'), 1100);
      prevEnabled.current = enabled;
      return () => clearTimeout(t);
    }
    prevEnabled.current = enabled;
  }, [enabled]);

  return (
    <button
      ref={btnRef}
      onClick={onClick}
      className={`power-toggle rivals-condensed ${enabled ? 'is-on' : 'is-off'}`}
      data-tip={enabled ? 'Click to disable' : 'Click to enable'}
      aria-label={enabled ? 'Disable mod' : 'Enable mod'}
    >
      <span className="power-dot" />
      {enabled ? 'Enabled' : 'Disabled'}
    </button>
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

  // ── Multi-select (Ctrl+click) ──
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const setModsEnabled = useSetModsEnabled();
  const deleteMods = useDeleteMods();

  const toggleBulkSelect = useCallback((id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Stable select handler so memoized virtual cards never see a new callback.
  // Ctrl/Cmd+click toggles multi-select; plain click opens the details panel.
  const handleSelectMod = useCallback((id: string, additive?: boolean) => {
    if (additive) toggleBulkSelect(id);
    else setSelectedModId(id);
  }, [setSelectedModId, toggleBulkSelect]);

  // Esc clears the selection
  useEffect(() => {
    if (bulkSelected.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBulkSelected(new Set());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bulkSelected.size]);

  const bulkEnable = (enabled: boolean) => {
    setModsEnabled.mutate({ modIds: [...bulkSelected], enabled });
    setBulkSelected(new Set());
  };
  const bulkDelete = () => {
    const n = bulkSelected.size;
    if (confirm(`Delete ${n} selected mod${n === 1 ? '' : 's'}? Their files are removed from the game folder.`)) {
      deleteMods.mutate([...bulkSelected]);
      setBulkSelected(new Set());
    }
  };

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
        case 'size':
          return (b.fileSize || 0) - (a.fileSize || 0) || (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
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

  // ── Grid virtualization ──
  // Card rows are chunked to the current column count and only the rows in
  // (or near) the viewport are mounted. Row height = card width * 16:9 art
  // ratio + fixed chrome; measureElement refines the estimate after render.
  // The scroll container mounts after the loading skeleton, so track it with
  // a callback ref (state) — a plain ref + mount effect would observe null.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  useEffect(() => {
    if (!scrollEl) return;
    const ro = new ResizeObserver(() => setScrollWidth(scrollEl.clientWidth));
    ro.observe(scrollEl);
    setScrollWidth(scrollEl.clientWidth);
    return () => ro.disconnect();
  }, [scrollEl]);

  // Mirror of the CSS grid the cards used before virtualization:
  // repeat(auto-fill, minmax(340px, 1fr)) with 20px gap and 22px side padding
  const GRID_MIN_CARD = 340;
  const GRID_GAP = 20;
  const GRID_SIDE_PAD = 22;
  const gridCols = Math.max(1, Math.floor((scrollWidth - GRID_SIDE_PAD * 2 + GRID_GAP) / (GRID_MIN_CARD + GRID_GAP)));
  const gridCardWidth = (scrollWidth - GRID_SIDE_PAD * 2 - (gridCols - 1) * GRID_GAP) / gridCols;

  const gridRows = useMemo(() => {
    const rows: ModInfo[][] = [];
    for (let i = 0; i < parentMods.length; i += gridCols) {
      rows.push(parentMods.slice(i, i + gridCols));
    }
    return rows;
  }, [parentMods, gridCols]);

  const rowVirtualizer = useVirtualizer({
    count: gridRows.length,
    getScrollElement: () => scrollEl,
    // 16:9 art + ~233px of card chrome below it + the 20px row gap
    estimateSize: () => Math.round((gridCardWidth * 9) / 16 + 233 + GRID_GAP),
    overscan: 8,
    enabled: viewMode === 'grid',
  });

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
        </div>

        {/* Bulk action strip (Cards + Gallery only) */}
        {viewMode !== 'list' && parentMods.length > 0 && <BulkActionStrip />}

        {/* Content */}
        <div ref={setScrollEl} className={`flex-1 overflow-auto mod-list-scroll${isGallery ? ' gallery-scroll-fade' : ''}`}>
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
            <div style={{ padding: '12px 0 18px' }}>
              <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((vRow) => (
                  <div
                    key={vRow.key}
                    data-index={vRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
                  >
                    <div
                      className="grid"
                      style={{
                        gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                        gap: GRID_GAP,
                        padding: `0 ${GRID_SIDE_PAD}px ${GRID_GAP}px`,
                        alignItems: 'start',
                      }}
                    >
                      {gridRows[vRow.index]?.map((mod) => (
                        <VirtualModCard
                          key={mod.id}
                          mod={mod}
                          allCostumes={allCostumes}
                          sortBy={sortBy}
                          addons={addonsByParent.get(mod.id)}
                          expanded={isAddonsOpen(mod.id)}
                          hasConflict={conflictIds.has(mod.id)}
                          selected={bulkSelected.has(mod.id)}
                          highlightAddonIds={highlightAddonIds}
                          onToggleExpand={toggleExpand}
                          onSelect={handleSelectMod}
                          onCardContextMenu={handleContextMenu}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
                    selected={bulkSelected.has(mod.id)}
                    highlightAddonIds={highlightAddonIds}
                    onToggleExpand={() => toggleExpand(mod.id)}
                    onClick={(e) => handleSelectMod(mod.id, e.ctrlKey || e.metaKey)}
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

      {/* Multi-select action bar (Ctrl+click cards to select, Esc to clear) */}
      {bulkSelected.size > 0 && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl"
          style={{ padding: '9px 10px 9px 16px', background: c.panel, border: `1px solid ${c.line2}`, boxShadow: '0 14px 40px rgba(0,0,0,0.55)' }}
        >
          <span className="rivals-mono" style={{ color: c.ink, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {bulkSelected.size} selected
          </span>
          <span style={{ width: 1.5, height: 16, background: c.line2, transform: 'skewX(-18deg)', margin: '0 4px' }} />
          <button
            onClick={() => bulkEnable(true)}
            className="rivals-condensed cursor-pointer"
            style={{ padding: '5px 12px', borderRadius: 7, background: 'transparent', color: c.ok, border: `1px solid ${tint(c.ok, 35)}`, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}
          >
            Enable
          </button>
          <button
            onClick={() => bulkEnable(false)}
            className="rivals-condensed cursor-pointer"
            style={{ padding: '5px 12px', borderRadius: 7, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}
          >
            Disable
          </button>
          <button
            onClick={bulkDelete}
            className="rivals-condensed cursor-pointer"
            style={{ padding: '5px 12px', borderRadius: 7, background: tint(c.err, 12), color: c.err, border: `1px solid ${tint(c.err, 40)}`, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}
          >
            Delete
          </button>
          <button
            onClick={() => setBulkSelected(new Set())}
            className="grid place-items-center cursor-pointer"
            data-tip="Clear selection (Esc)"
            aria-label="Clear selection"
            style={{ width: 26, height: 26, borderRadius: 7, background: 'transparent', color: c.ink3, border: 'none', fontSize: 15, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {contextMenu && (
        <ModContextMenu mod={contextMenu.mod} x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} />
      )}
    </>
  );
}

// ── Add-on expand trigger ────────────────────────────────────────────────────
// Custom plus icon + condensed count in the footer language; the plus rotates
// into an × while the drawer is open (the universal "this closes it" cue).
function AddonTrigger({ count, expanded, onClick }: { count: number; expanded: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      data-tip={expanded ? 'Close add-ons' : `${count} attached add-on${count > 1 ? 's' : ''}`}
      className="addon-btn rivals-condensed inline-flex items-center cursor-pointer"
      style={{
        gap: 4,
        padding: '4px 7px',
        borderRadius: 6,
        background: expanded ? tint(c.warn, 16) : 'transparent',
        color: c.warn,
        border: 'none',
        fontSize: 13.5,
        fontWeight: 700,
        letterSpacing: '0.06em',
        lineHeight: 1,
      }}
    >
      <span style={{ display: 'inline-flex', transition: 'transform 150ms ease', transform: expanded ? 'rotate(45deg)' : 'none' }}>
        <PlusIcon stroke={c.warn} size={11} />
      </span>
      {count}
    </button>
  );
}

interface CardProps {
  mod: ModInfo;
  allCostumes: Record<string, Costume[]> | undefined;
  sortBy: string;
  addons?: ModInfo[];
  expanded: boolean;
  hasConflict?: boolean;
  selected?: boolean;
  highlightAddonIds?: Set<string>;
  onToggleExpand: () => void;
  onClick: (e: React.MouseEvent) => void;
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
              <img src={convertFileSrc(addon.thumbnailPath)} alt="" loading="lazy" style={{ width: thumbW, height: thumbH, borderRadius: 5, objectFit: 'cover', border: `1px solid ${c.line2}`, flex: '0 0 auto', opacity: addon.enabled ? 1 : 0.45, filter: addon.enabled ? 'none' : 'grayscale(0.7)', transition: 'opacity 200ms ease, filter 200ms ease' }} />
            ) : (
              <span style={{ width: thumbW, height: thumbH, borderRadius: 5, border: `1px solid ${c.line2}`, display: 'grid', placeItems: 'center', color: c.ink3, flex: '0 0 auto', opacity: addon.enabled ? 1 : 0.45 }}>+</span>
            )}
            <div className="min-w-0 flex-1" style={{ opacity: addon.enabled ? 1 : 0.5, transition: 'opacity 200ms ease' }}>
              <div className="truncate" style={{ color: c.ink, fontFamily: c.font, fontSize: titleSize, fontWeight: 600 }}>{addonDisplayName(addon.metadata.title || addon.name, parentName)}</div>
              <div className="flex items-center gap-2" style={{ color: c.ink3, fontFamily: c.font, fontSize: 11, marginTop: 2 }}>
                <KickerTag color={categoryColor(addon.category)} label={addon.category} size={9.5} icon={<CategoryIcon category={addon.category} stroke={categoryColor(addon.category)} size={9} />} />
                <span>{formatFileSize(addon.fileSize)}</span>
              </div>
            </div>
            <MiniPower
              on={addon.enabled && parentEnabled}
              disabled={!parentEnabled}
              label={addon.enabled ? 'On' : 'Off'}
              tip={!parentEnabled ? 'Enable parent mod first' : undefined}
              onClick={(e) => { e.stopPropagation(); if (parentEnabled) toggleEnabled.mutate(addon.id); }}
            />
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
  selected,
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
      className={`mod-card mod-card-tilt flex flex-col overflow-hidden cursor-pointer${hasAddons && expanded ? ' addons-open' : ''}${selected ? ' is-selected' : ''}`}
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
        {/* Multi-select check badge */}
        {selected && (
          <div
            className="absolute grid place-items-center"
            style={{ top: 10, right: 12, zIndex: 11, width: 26, height: 26, borderRadius: '50%', background: c.accent, color: c.onAccent, fontSize: 14, fontWeight: 700, boxShadow: '0 2px 10px rgba(0,0,0,0.45)' }}
          >
            ✓
          </div>
        )}
        {/* Corner plate: category/NSFW/conflict kickers on dark glass */}
        <div className="art-tag-plate">
          <KickerTag
            color={categoryColor(mod.category)}
            label={mod.category}
            icon={<CategoryIcon category={mod.category} stroke={categoryColor(mod.category)} size={11} />}
          />
          {mod.metadata.isNsfw && (
            <KickerTag color="var(--rivals-nsfw-bright)" label="NSFW" icon={<WarnIcon stroke="var(--rivals-nsfw-bright)" size={11} />} />
          )}
          {hasConflict && (
            <KickerTag color={c.warn} label="Conflict" icon={<WarnIcon stroke={c.warn} size={11} />} tip="This mod overwrites the same files as another enabled mod" />
          )}
        </div>
        {hasAddons && (
          <AddonDrawer open={expanded} count={addonList.length} onClose={onToggleExpand}>
            <AddonRows overlay parentEnabled={mod.enabled} parentName={mod.metadata.title || mod.name} addons={addonList} highlightAddonIds={highlightAddonIds} onAddonClick={onAddonClick} onAddonContextMenu={onAddonContextMenu} />
          </AddonDrawer>
        )}
      </div>

      {/* Hairline seam + artwork-tinted backlight bleeding into the body */}
      <div aria-hidden className="card-glow-seam" />

      <div className="flex flex-col" style={{ padding: '11px 16px 13px', gap: 10, position: 'relative' }}>
        {/* Title flush under the art, full width; subtitle tucked under it */}
        <div>
          <div className="rivals-condensed" style={{ color: c.ink, fontSize: 30, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.02, textTransform: 'uppercase' }}>
            {main}
          </div>
          {(variant || mod.metadata.subtitle) && (
            <div className="flex items-baseline gap-2" style={{ marginTop: 3 }}>
              {variant && (
                <span className="rivals-display" style={{ color: c.ink2, fontSize: 14.5, fontStyle: 'italic', fontWeight: 500 }}>
                  {variant}
                </span>
              )}
              {variant && mod.metadata.subtitle && <span style={{ color: c.muted, fontSize: 12 }}>·</span>}
              {mod.metadata.subtitle && (
                <span style={{ color: c.ink3, fontFamily: c.font, fontSize: 12.5 }}>{mod.metadata.subtitle}</span>
              )}
            </div>
          )}
        </div>

        {/* Credits line: hero portrait(s) + NAME ⫽ costume */}
        {mod.character && (
          <div className="card-credits">
            {mod.character === 'All Characters' ? (
              <span
                className="rivals-mono"
                style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: tint(c.accent, 13), border: `1.5px solid ${tint(c.accent, 38)}`, color: c.accent, fontSize: 12, fontWeight: 700 }}
              >
                AC
              </span>
            ) : (
              <RingAvatar src={getCharacterIconPath(mod.character)} alt={mod.character} size={36} />
            )}
            {costume && !costume.isDefault && costume.name !== 'Default' && (
              <span style={{ marginLeft: -15, flexShrink: 0, display: 'inline-flex' }}>
                <RingAvatar src={getCostumeIconSrc(costume)} alt={costume.name} size={36} />
              </span>
            )}
            <span className="rivals-condensed truncate" style={{ color: c.ink2, fontSize: 16.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', flexShrink: 0 }}>
              {mod.character}
            </span>
            <span className="card-credits-slash" />
            <span className="rivals-display truncate" style={{ color: c.ink3, fontSize: 14, fontStyle: 'italic' }}>
              {costume?.name ?? 'Default'}
            </span>
          </div>
        )}

        {/* Footer rail: mono credits, favorite, add-ons, power readout */}
        <div className="flex items-center" style={{ gap: 8, paddingTop: 9, marginTop: 1, borderTop: `1px solid ${c.line}` }}>
          <span className="truncate rivals-mono" style={{ color: c.ink3, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            {mod.metadata.author || 'Unknown'}
            <span style={{ color: c.muted }}> · </span>
            {formatFileSize(mod.fileSize)}
            <span style={{ color: c.muted }}> · </span>
            {dateStr}
          </span>
          <div className="flex items-center" style={{ gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleFavorite.mutate(mod.id); }}
              className="fav-btn grid place-items-center cursor-pointer"
              style={{ width: 26, height: 26, borderRadius: 7, background: 'transparent', color: mod.isFavorite ? c.warn : c.ink3, fontSize: 16, lineHeight: 1 }}
              data-tip={mod.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={mod.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {mod.isFavorite ? '★' : '☆'}
            </button>
            {hasAddons && <AddonTrigger count={addonList.length} expanded={expanded} onClick={(e) => { e.stopPropagation(); onToggleExpand(); }} />}
            <PowerToggle enabled={mod.enabled} onClick={(e) => { e.stopPropagation(); toggleEnabled.mutate(mod.id); }} />
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
  selected,
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
      className={`mod-card mod-card-tilt gallery-hero flex flex-col overflow-hidden cursor-pointer relative${hasAddons && expanded ? ' addons-open' : ''}${selected ? ' is-selected' : ''}`}
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

        {/* Multi-select check badge (left of the favorite button) */}
        {selected && (
          <div
            className="absolute z-10 grid place-items-center"
            style={{ top: 12, right: 56, width: 26, height: 26, borderRadius: '50%', background: c.accent, color: c.onAccent, fontSize: 14, fontWeight: 700, boxShadow: '0 2px 10px rgba(0,0,0,0.45)' }}
          >
            ✓
          </div>
        )}
        {/* Corner plate top-left (the title owns the bottom of the art) */}
        <div className="art-tag-plate is-top">
          <KickerTag
            color={categoryColor(mod.category)}
            label={mod.category}
            icon={<CategoryIcon category={mod.category} stroke={categoryColor(mod.category)} size={11} />}
          />
          {mod.metadata.isNsfw && (
            <KickerTag color="var(--rivals-nsfw-bright)" label="NSFW" icon={<WarnIcon stroke="var(--rivals-nsfw-bright)" size={11} />} />
          )}
          {hasConflict && (
            <KickerTag color={c.warn} label="Conflict" icon={<WarnIcon stroke={c.warn} size={11} />} tip="This mod overwrites the same files as another enabled mod" />
          )}
        </div>

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

      {/* Hairline seam + artwork-tinted backlight bleeding into the body */}
      <div aria-hidden className="card-glow-seam" />

      <div className="flex flex-col" style={{ padding: '13px 20px 15px', gap: 11, position: 'relative' }}>
        {/* Credits line: hero portrait(s) + NAME ⫽ costume, gallery-scaled */}
        {mod.character && (
          <div className="card-credits">
            {mod.character === 'All Characters' ? (
              <span
                className="rivals-mono"
                style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: tint(c.accent, 13), border: `1.5px solid ${tint(c.accent, 38)}`, color: c.accent, fontSize: 13, fontWeight: 700 }}
              >
                AC
              </span>
            ) : (
              <RingAvatar src={getCharacterIconPath(mod.character)} alt={mod.character} size={42} />
            )}
            {costume && !costume.isDefault && costume.name !== 'Default' && (
              <span style={{ marginLeft: -17, flexShrink: 0, display: 'inline-flex' }}>
                <RingAvatar src={getCostumeIconSrc(costume)} alt={costume.name} size={42} />
              </span>
            )}
            <span className="rivals-condensed truncate" style={{ color: c.ink2, fontSize: 18, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', flexShrink: 0 }}>
              {mod.character}
            </span>
            <span className="card-credits-slash" style={{ height: 19 }} />
            <span className="rivals-display truncate" style={{ color: c.ink3, fontSize: 15, fontStyle: 'italic' }}>
              {costume?.name ?? 'Default'}
            </span>
          </div>
        )}

        {/* Footer rail: mono credits + add-ons + power readout */}
        <div className="flex items-center" style={{ gap: 8, paddingTop: 10, borderTop: `1px solid ${c.line}` }}>
          <span className="truncate rivals-mono" style={{ color: c.ink3, fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            {formatFileSize(mod.fileSize)}
            <span style={{ color: c.muted }}> · </span>
            {dateStr}
            {mod.metadata.version && (
              <>
                <span style={{ color: c.muted }}> · </span>
                v{mod.metadata.version}
              </>
            )}
          </span>
          <div className="flex items-center" style={{ gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
            {hasAddons && <AddonTrigger count={addonList.length} expanded={expanded} onClick={(e) => { e.stopPropagation(); onToggleExpand(); }} />}
            <PowerToggle enabled={mod.enabled} onClick={(e) => { e.stopPropagation(); toggleEnabled.mutate(mod.id); }} />
          </div>
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
              <KickerTag color="var(--rivals-nsfw-bright)" label="NSFW" size={9.5} icon={<WarnIcon stroke="var(--rivals-nsfw-bright)" size={9} />} />
            )}
            {hasAddons && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                className="addon-btn rivals-condensed inline-flex items-center cursor-pointer"
                style={{ gap: 4, padding: '2px 7px', borderRadius: 5, background: expanded ? tint(c.warn, 16) : 'transparent', color: c.warn, border: 'none', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.4 }}
              >
                <span style={{ display: 'inline-flex', transition: 'transform 150ms ease', transform: expanded ? 'rotate(45deg)' : 'none' }}>
                  <PlusIcon stroke={c.warn} size={9} />
                </span>
                {addonList.length} add-on{addonList.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
          {mod.metadata.tags && mod.metadata.tags.length > 0 && (
            <span style={{ color: c.ink3, fontSize: 10.5 }} className="truncate">{mod.metadata.tags.join(' · ')}</span>
          )}
        </div>
        <span className="truncate" style={{ color: c.ink2 }}>{costume?.name ?? (mod.character ? 'Default' : '—')}</span>
        <span className="inline-flex items-center gap-1.5" style={{ color: categoryColor(mod.category), fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          <CategoryIcon category={mod.category} stroke={categoryColor(mod.category)} size={9} />
          {mod.category}
        </span>
        <span className="truncate" style={{ color: c.ink2 }}>{mod.metadata.author || 'Unknown'}</span>
        <span style={{ color: c.ink3, textAlign: 'right' }}>{formatFileSize(mod.fileSize)}</span>
        <MiniPower
          on={mod.enabled}
          label={mod.enabled ? 'Active' : 'Off'}
          onClick={(e) => { e.stopPropagation(); toggleEnabled.mutate(mod.id); }}
        />
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
                <div style={{ width: 38, height: 24, overflow: 'hidden', border: `1px solid ${c.line2}`, borderRadius: 3, background: c.bg, opacity: a.enabled ? 1 : 0.45 }}>
                  {a.thumbnailPath && <img src={convertFileSrc(a.thumbnailPath)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ filter: a.enabled ? 'none' : 'grayscale(0.7)' }} />}
                </div>
                <span style={{ color: c.muted, fontSize: 10 }}>↳</span>
                <span className="truncate" style={{ color: a.enabled && mod.enabled ? c.ink : c.muted, fontFamily: c.font, fontSize: 12, fontWeight: 500, opacity: a.enabled ? 1 : 0.6 }}>{addonDisplayName(a.metadata.title || a.name, mod.metadata.title || mod.name)}</span>
                <span>
                  <KickerTag color={categoryColor(a.category)} label={a.category} size={9.5} icon={<CategoryIcon category={a.category} stroke={categoryColor(a.category)} size={9} />} />
                </span>
                <span style={{ color: c.ink3, textAlign: 'right' }}>{formatFileSize(a.fileSize)}</span>
                <MiniPower
                  on={on}
                  disabled={!mod.enabled}
                  label={a.enabled ? 'Active' : 'Off'}
                  onClick={(e) => { e.stopPropagation(); if (mod.enabled) toggleEnabled.mutate(a.id); }}
                />
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
    <div className="flex flex-col" style={{ margin: '10px 28px 0', gap: 4 }}>
      {/* Row 1: condensed underline tabs + kicker-style category filters */}
      <div className="flex items-center flex-wrap" style={{ gap: 18 }}>
        <button
          onClick={() => withViewTransition(() => setFilters({ showFavorites: false, category: null, character: null }))}
          className={`ribbon-tab rivals-condensed ${allActive ? 'is-active' : ''}`}
        >
          All Mods
        </button>
        <button
          onClick={() => withViewTransition(() => setFilters({ showFavorites: true, category: null, character: null }))}
          className={`ribbon-tab rivals-condensed ${filters.showFavorites ? 'is-active' : ''}`}
        >
          Favorites
        </button>

        <span className="card-credits-slash" style={{ height: 16 }} />

        {CATS.map((cat) => {
          const active = filters.category === cat;
          const col = categoryColor(cat);
          return (
            <button
              key={cat}
              onClick={() => withViewTransition(() => setFilters({ category: active ? null : cat, character: null, showFavorites: false }))}
              className={`ribbon-tab rivals-condensed ${active ? 'is-active' : ''}`}
              style={active ? { color: col, ['--tab-accent' as string]: col } : undefined}
            >
              <CategoryIcon category={cat} stroke={active ? col : 'currentColor'} size={11} />
              {cat}
              <span className="rivals-mono" style={{ color: active ? col : c.muted, fontSize: 10, fontWeight: 400, letterSpacing: 0 }}>
                {catCounts[cat] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Row 2: cast rail — portraits only, active hero ringed in accent */}
      <div
        ref={railRef}
        onWheel={onRailWheel}
        className="gallery-rail flex items-center overflow-x-auto overflow-y-visible"
        style={{ gap: 11, paddingTop: 10, paddingBottom: 12 }}
      >
        <button
          onClick={() => withViewTransition(() => setFilters({ character: null }))}
          className={`cast-chip rivals-mono ${!filters.character ? 'is-active' : ''}`}
          data-tip="All characters"
          aria-label="All characters"
        >
          <span
            style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: tint(c.accent, 13), border: `1.5px solid ${tint(c.accent, 38)}`, color: c.accent, fontSize: 11, fontWeight: 700 }}
          >
            ALL
          </span>
        </button>
        {railChars.map((ch) => {
          const active = filters.character === ch;
          return (
            <button
              key={ch}
              onClick={() => withViewTransition(() => setFilters({ character: active ? null : ch, category: null, showFavorites: false }))}
              className={`cast-chip ${active ? 'is-active' : ''}`}
              data-tip={ch}
              aria-label={ch}
            >
              <RingAvatar src={getCharacterIconPath(ch)} alt={ch} size={44} />
              <span className="cast-badge rivals-mono">{charCounts[ch]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
