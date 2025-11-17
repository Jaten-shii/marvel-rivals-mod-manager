import { useState } from 'react';
import { useUIStore as useUIStoreOld } from '@/store/ui-store';
import { useUIStore, type SortOption } from '../stores';
import { open } from '@tauri-apps/plugin-dialog';
import * as opener from '@tauri-apps/plugin-opener';
import { toast } from 'sonner';

interface ToolbarProps {
  onArchiveSelect?: (filePaths: string[]) => void;
}

export function Toolbar({ onArchiveSelect }: ToolbarProps) {
  const { filters, setFilters, viewMode, setViewMode, sortBy, setSortBy } = useUIStore();
  const { setPreferencesOpen } = useUIStoreOld();
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Handle Add Mod button click
  const handleAddModClick = async () => {
    try {
      const files = await open({
        multiple: true,
        filters: [
          {
            name: 'Mod Files',
            extensions: ['pak', 'zip', '7z', 'rar'],
          },
        ],
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

  // Handle Browse NexusMods button click
  const handleBrowseNexusMods = async () => {
    try {
      await opener.openUrl('https://www.nexusmods.com/marvelrivals');
    } catch (error) {
      console.error('Failed to open NexusMods:', error);
      toast.error('Failed to open NexusMods');
    }
  };

  return (
    <div className="border-b border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        {/* Left: Action Buttons */}
        <button
          onClick={handleAddModClick}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:brightness-110 active:brightness-95 transition-all flex items-center gap-2 cursor-pointer group"
        >
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Mod
        </button>

        <button
          onClick={handleBrowseNexusMods}
          className="px-4 py-2 bg-[#191F24] text-white rounded-md font-medium text-sm border border-transparent transition-all duration-200 flex items-center gap-2 cursor-pointer hover:bg-primary/20 hover:text-primary hover:border-primary/40 group"
        >
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110 will-change-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 01 9-9" />
          </svg>
          Browse Nexus Mods
        </button>

        {/* Center: Search */}
        <div className="flex-1 flex items-center bg-[#191F24] rounded-md px-3 py-1.5">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search mods..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="flex-1 bg-transparent border-none outline-none px-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="px-3 py-2 bg-[#191F24] text-foreground rounded-md text-sm hover:bg-[#2a2a2a] hover:text-white transition-all flex items-center gap-2 cursor-pointer group"
            >
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110 will-change-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Sort by {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
              <svg className="w-3 h-3 transition-transform duration-200 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showSortMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-50">
                {[
                  { value: 'date' as SortOption, label: 'Date Installed', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
                  { value: 'updated' as SortOption, label: 'Last Updated', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
                  { value: 'name' as SortOption, label: 'Name', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
                  { value: 'category' as SortOption, label: 'Category', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
                  { value: 'character' as SortOption, label: 'Character', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
                  { value: 'profile' as SortOption, label: 'Profile', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSortBy(option.value);
                      setShowSortMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 ${
                      sortBy === option.value ? 'bg-accent text-accent-foreground' : ''
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={option.icon} />
                    </svg>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Mode Toggles */}
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-all cursor-pointer group ${
              viewMode === 'grid'
                ? 'bg-primary text-primary-foreground'
                : 'bg-[#191F24] text-foreground hover:bg-[#2a2a2a] hover:text-white'
            }`}
            title="Grid View"
          >
            <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110 will-change-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>

          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-all cursor-pointer group ${
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'bg-[#191F24] text-foreground hover:bg-[#2a2a2a] hover:text-white'
            }`}
            title="List View"
          >
            <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110 will-change-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* NSFW Toggle Button */}
          <button
            onClick={() => setFilters({ showNsfw: !filters.showNsfw })}
            className={`p-2 rounded-md transition-all cursor-pointer group ${
              filters.showNsfw
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-[#191F24] text-foreground hover:bg-red-500/20 hover:text-red-400 hover:border hover:border-red-500/30'
            }`}
            title={filters.showNsfw ? 'Hide NSFW Mods' : 'Show NSFW Mods'}
          >
            {filters.showNsfw ? (
              // Unlocked icon (NSFW shown)
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110 will-change-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            ) : (
              // Locked icon (NSFW hidden)
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110 will-change-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => setPreferencesOpen(true)}
            className="p-2 bg-[#191F24] text-foreground rounded-md hover:bg-[#2a2a2a] hover:text-white transition-all cursor-pointer group"
            title="Settings"
          >
            <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
