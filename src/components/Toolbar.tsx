import { useState, useRef, useEffect } from 'react';
import { useUIStore as useUIStoreOld } from '@/store/ui-store';
import { useUIStore, type SortOption } from '../stores';
import type { ViewMode } from '../types/mod.types';
import { open } from '@tauri-apps/plugin-dialog';
import * as opener from '@tauri-apps/plugin-opener';
import { toast } from 'sonner';
import { c, tint } from '../shared/rivals-tokens';
import { APP_VERSION } from '../shared/constants';
import { useUpdater } from '../hooks/useUpdater';
import { Lock, Unlock, ArrowUp } from 'lucide-react';
import { ConflictsButton } from './ConflictsButton';

interface ToolbarProps {
  onArchiveSelect?: (filePaths: string[]) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'character', label: 'Character' },
  { value: 'name', label: 'Name' },
  { value: 'updated', label: 'Recently Updated' },
  { value: 'category', label: 'Category' },
  { value: 'profile', label: 'Profile' },
  { value: 'date', label: 'Date Installed' },
];

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'grid', label: 'Cards', icon: '▦' },
  { id: 'gallery', label: 'Gallery', icon: '◰' },
  { id: 'list', label: 'List', icon: '☰' },
];

export function Toolbar({ onArchiveSelect }: ToolbarProps) {
  const filters = useUIStore((state) => state.filters);
  const setFilters = useUIStore((state) => state.setFilters);
  const viewMode = useUIStore((state) => state.viewMode);
  const setViewMode = useUIStore((state) => state.setViewMode);
  const sortBy = useUIStore((state) => state.sortBy);
  const setSortBy = useUIStore((state) => state.setSortBy);
  const setChangelogDialogOpen = useUIStore((state) => state.setChangelogDialogOpen);
  const setUpdateDialogOpen = useUIStore((state) => state.setUpdateDialogOpen);
  const { setPreferencesOpen } = useUIStoreOld();
  const { availableUpdate } = useUpdater();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort menu on outside click
  useEffect(() => {
    if (!showSortMenu) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortMenu]);

  const handleAddModClick = async () => {
    try {
      const files = await open({
        multiple: true,
        filters: [{ name: 'Mod Files', extensions: ['pak', 'zip', '7z', 'rar'] }],
      });
      if (files) {
        const filePaths = Array.isArray(files) ? files : [files];
        onArchiveSelect?.(filePaths);
      }
    } catch (error) {
      console.error('Failed to select files:', error);
      toast.error('Failed to select files');
    }
  };

  const handleBrowseNexusMods = async () => {
    try {
      await opener.openUrl('https://www.nexusmods.com/marvelrivals');
    } catch (error) {
      console.error('Failed to open NexusMods:', error);
      toast.error('Failed to open NexusMods');
    }
  };

  const nsfwShown = filters.showNsfw;
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Character';

  return (
    <div
      className="flex items-center gap-2.5 py-3.5 pl-3 pr-[22px]"
      style={{ background: c.bg, borderBottom: `1px solid ${c.line}` }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 mr-1">
        <img
          src="/icon.png"
          alt="Marvel Rivals Mod Manager"
          className="flex-shrink-0"
          style={{ width: 32, height: 32, objectFit: 'contain' }}
        />
        <div className="flex flex-col">
          <span className="rivals-display leading-tight" style={{ color: c.ink, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Marvel Rivals Mod Manager
          </span>
          <div className="flex items-center gap-1.5">
            <span style={{ color: c.ink3, fontFamily: c.mono, fontSize: 9.5 }}>v {APP_VERSION}</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: c.muted }} />
            <button
              onClick={() => setChangelogDialogOpen(true)}
              className="rivals-mono link-btn cursor-pointer inline-block"
              style={{ color: c.accent, fontSize: 11.5 }}
            >
              What&apos;s new →
            </button>
          </div>
        </div>
        {availableUpdate && (
          <button
            onClick={() => setUpdateDialogOpen(true)}
            data-tip={`Update available${availableUpdate.version ? ` — v${availableUpdate.version}` : ''}`}
        data-tip-side="bottom"
            className="update-pill flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
            style={{
              marginLeft: 4,
              padding: '6px 12px 6px 9px',
              borderRadius: 999,
              background: c.accent2,
              color: '#fff',
              border: 'none',
              fontFamily: c.font,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <span className="update-arrow grid place-items-center" style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.22)' }}>
              <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.5} />
            </span>
            Update
          </button>
        )}
      </div>

      {/* divider */}
      <span style={{ width: 1, height: 26, background: c.line }} />

      {/* Add Mod */}
      <button
        onClick={handleAddModClick}
        className="btn-primary flex items-center gap-2 px-3.5 py-2 rounded-[7px] cursor-pointer"
        style={{
          background: c.accent,
          color: c.onAccent,
          fontFamily: c.font,
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        <svg className="btn-glyph w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Mod
      </button>

      {/* Browse Nexus */}
      <button
        onClick={handleBrowseNexusMods}
        className="btn-outline px-3.5 py-2 rounded-[7px] cursor-pointer"
        style={{
          background: 'transparent',
          color: c.ink,
          border: `1px solid ${c.line2}`,
          fontFamily: c.font,
          fontSize: 13,
        }}
      >
        Browse Nexus
      </button>

      {/* Search */}
      <div className="search-wrap flex-1 relative ml-2">
        <span
          className="search-glyph absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: c.ink3, fontSize: 17 }}
        >
          ⌕
        </span>
        <input
          type="text"
          placeholder="Search mods, authors, tags…"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          className="toolbar-search w-full py-2 pl-8 pr-3 rounded-[7px] outline-none"
          style={{
            background: c.panel,
            color: c.ink,
            border: `1px solid ${c.line}`,
            fontFamily: c.font,
            fontSize: 13,
          }}
        />
      </div>

      {/* View toggle */}
      <div
        className="flex gap-1 p-[3px] rounded-[7px]"
        style={{ background: c.panel, border: `1px solid ${c.line}` }}
      >
        {VIEW_OPTIONS.map((v) => {
          const active = viewMode === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={`view-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded cursor-pointer ${active ? 'is-active' : ''}`}
              style={{ fontFamily: c.font, fontSize: 12 }}
              data-tip={`${v.label} view`} data-tip-side="bottom"
            >
              <span className="view-btn-icon" style={{ fontSize: 11 }}>{v.icon}</span>
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Conflict alert — only visible when conflicts exist */}
      <ConflictsButton />

      {/* NSFW lock — icon only; red (unlocked) when NSFW is shown */}
      <button
        onClick={() => setFilters({ showNsfw: !nsfwShown })}
        className="icon-btn flex items-center justify-center w-8 h-8 rounded-[7px] cursor-pointer"
        style={{
          ['--btn-hue' as string]: c.nsfw,
          background: nsfwShown ? tint(c.nsfw, 12) : c.panel,
          color: nsfwShown ? c.nsfw : c.ink2,
          border: `1px solid ${nsfwShown ? tint(c.nsfw, 40) : c.line}`,
        }}
        data-tip={nsfwShown ? 'NSFW visible — click to hide' : 'NSFW hidden — click to show'}
        aria-label={nsfwShown ? 'Hide NSFW mods' : 'Show NSFW mods'}
        data-tip-side="bottom"
      >
        <span className="icon-btn-glyph inline-flex">{nsfwShown ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</span>
      </button>

      {/* Sort */}
      <div className="relative" ref={sortRef}>
        <button
          onClick={() => setShowSortMenu((s) => !s)}
          className="btn-outline flex items-center gap-1.5 px-3 py-[7px] rounded-[7px] cursor-pointer"
          style={{
            background: c.panel,
            color: c.ink2,
            border: `1px solid ${c.line}`,
            fontFamily: c.font,
            fontSize: 12.5,
          }}
        >
          <span style={{ color: c.ink3 }}>Sort:</span> {sortLabel}{' '}
          <span style={{ display: 'inline-block', transition: 'transform 180ms ease', transform: showSortMenu ? 'rotate(180deg)' : 'none', color: c.ink3 }}>▾</span>
        </button>
        {showSortMenu && (
          <div
            className="menu-pop absolute right-0 mt-1 w-52 rounded-lg z-50 overflow-hidden py-1"
            style={{ background: c.panel, border: `1px solid ${c.line2}`, boxShadow: '0 12px 28px rgba(0,0,0,0.5)' }}
          >
            {SORT_OPTIONS.map((option) => {
              const active = sortBy === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    setSortBy(option.value);
                    setShowSortMenu(false);
                  }}
                  className="menu-item w-full px-3.5 py-2 text-left cursor-pointer"
                  style={{
                    background: active ? c.panelHi : 'transparent',
                    color: active ? c.ink : c.ink2,
                    fontFamily: c.font,
                    fontSize: 12.5,
                    boxShadow: active ? `inset 2px 0 0 ${c.accent}` : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) { e.currentTarget.style.background = tint(c.accent, 12); e.currentTarget.style.color = c.accent as string; }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.ink2 as string; }
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Settings */}
      <button
        onClick={() => setPreferencesOpen(true)}
        className="icon-btn gear flex items-center justify-center w-8 h-8 rounded-[7px] cursor-pointer"
        style={{ ['--btn-hue' as string]: c.accent, background: c.panel, color: c.ink2, border: `1px solid ${c.line}` }}
        data-tip="Settings" data-tip-side="bottom" aria-label="Settings"
      >
        <svg
          className="icon-btn-glyph w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  );
}
