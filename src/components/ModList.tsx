import { useState, useMemo, useCallback, memo } from 'react';
import { useGetMods, useGetAllCostumes, useToggleModEnabled, useToggleFavorite } from '../hooks/useMods';
import { useUIStore } from '../stores';
import type { ModInfo, Costume } from '../types/mod.types';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Link, AlertTriangle, Shirt, Volume2, Palette, Gamepad2, Tag, Star, Monitor, Users } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { ModContextMenu } from './ModContextMenu';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

// Lightweight animated wrapper using CSS transitions (GPU-accelerated)
// Uses content-visibility for scroll performance optimization
const AnimatedCard = memo(function AnimatedCard({
  children,
  index
}: {
  children: React.ReactNode;
  index: number
}) {
  // Cap the stagger delay to first 20 items (25ms each, max 500ms total)
  const delay = Math.min(index, 20) * 0.025;

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 duration-200 fill-mode-both"
      style={{
        animationDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
});

// Helper function to get character icon path
function getCharacterIconPath(character: string | null | undefined): string {
  if (!character) return '/assets/character-icons/default.png';

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
  const iconFileName = iconMap[character] || `${character}.png`;
  return `/assets/character-icons/${iconFileName}`;
}

// Helper function to get costume for a mod
function getCostumeForMod(
  mod: ModInfo,
  allCostumes: Record<string, Costume[]> | undefined
): Costume | null {
  if (!mod.character || !mod.metadata.costume || !allCostumes) return null;

  const characterCostumes = allCostumes[mod.character];
  if (!characterCostumes) return null;

  return characterCostumes.find(c => c.id === mod.metadata.costume) || null;
}

// Map icon names to Lucide components (same as ProfileItem)
const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap: LucideIcons.Zap,
  Flame: LucideIcons.Flame,
  Sparkles: LucideIcons.Sparkles,
  Star: LucideIcons.Star,
  Target: LucideIcons.Target,
  Rocket: LucideIcons.Rocket,
  Diamond: LucideIcons.Diamond,
  Wand: LucideIcons.Wand2,
  Shield: LucideIcons.Shield,
  Sword: LucideIcons.Sword,
  Trophy: LucideIcons.Trophy,
  Crown: LucideIcons.Crown,
  Gamepad2: LucideIcons.Gamepad2,
  Home: LucideIcons.Home,
  Heart: LucideIcons.Heart,
  Cog: LucideIcons.Settings,
  Triangle: LucideIcons.Triangle,
  Circle: LucideIcons.Circle,
  StarIcon: LucideIcons.Star,
  Moon: LucideIcons.Moon,
  ArrowRight: LucideIcons.ArrowRight,
  Volume2: LucideIcons.Volume2,
  Layers: LucideIcons.Layers,
  Disc: LucideIcons.Disc,
}

export function ModList() {
  const { data: mods, isLoading, error } = useGetMods();
  const { data: allCostumes } = useGetAllCostumes();

  // Use selective subscriptions to avoid re-renders when unrelated state changes
  const filters = useUIStore((state) => state.filters);
  const viewMode = useUIStore((state) => state.viewMode);
  const setSelectedModId = useUIStore((state) => state.setSelectedModId);
  const sortBy = useUIStore((state) => state.sortBy);
  const profiles = useUIStore((state) => state.profiles);
  const activeProfileFilter = useUIStore((state) => state.activeProfileFilter);

  const [contextMenu, setContextMenu] = useState<{ mod: ModInfo; x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, mod: ModInfo) => {
    e.preventDefault();
    setContextMenu({ mod, x: e.clientX, y: e.clientY });
  }, []);

  // Memoize filtering to avoid recalculating on every render
  const filteredMods = useMemo(() => {
    if (!mods) return [];

    return mods.filter((mod: ModInfo) => {
      // Search filter
      if (filters.search && !mod.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // Category filter
      if (filters.category && mod.category !== filters.category) {
        return false;
      }

      // Character filter
      if (filters.character && mod.character !== filters.character) {
        return false;
      }

      // Enabled/Disabled filter
      if (!filters.showEnabled && mod.enabled) {
        return false;
      }
      if (!filters.showDisabled && !mod.enabled) {
        return false;
      }

      // Favorites filter
      if (filters.showFavorites && !mod.isFavorite) {
        return false;
      }

      // NSFW filter
      if (!filters.showNsfw && mod.metadata.isNsfw) {
        return false;
      }

      // Profile filter
      if (activeProfileFilter && !mod.metadata.profileIds?.includes(activeProfileFilter)) {
        return false;
      }

      return true;
    });
  }, [mods, filters, activeProfileFilter]);

  // Memoize sorting to avoid recalculating on every render
  const sortedMods = useMemo(() => {
    if (!filteredMods.length) return [];

    // Create a copy to avoid mutating the memoized filtered array
    return [...filteredMods].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
        case 'category':
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
        case 'character': {
          const aChar = a.character || 'zzz';
          const bChar = b.character || 'zzz';
          if (aChar !== bChar) {
            return aChar.localeCompare(bChar);
          }

          const aCostumeLower = (a.metadata.costume || '').trim().toLowerCase();
          const bCostumeLower = (b.metadata.costume || '').trim().toLowerCase();
          const aIsDefault = !a.metadata.costume || aCostumeLower === 'default' || aCostumeLower === '';
          const bIsDefault = !b.metadata.costume || bCostumeLower === 'default' || bCostumeLower === '';

          if (aIsDefault !== bIsDefault) {
            return aIsDefault ? -1 : 1;
          }

          const aCostume = a.metadata.costume || '';
          const bCostume = b.metadata.costume || '';
          if (aCostume !== bCostume) {
            return aCostume.localeCompare(bCostume);
          }

          const categoryOrder: Record<string, number> = {
            'Skins': 1,
            'UI': 2,
            'Audio': 3,
            'Gameplay': 4,
          };
          const aCategoryOrder = categoryOrder[a.category] || 999;
          const bCategoryOrder = categoryOrder[b.category] || 999;
          if (aCategoryOrder !== bCategoryOrder) {
            return aCategoryOrder - bCategoryOrder;
          }

          return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
        }
        case 'updated':
          return new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime();
        case 'profile': {
          const aHasProfiles = (a.metadata.profileIds?.length || 0) > 0;
          const bHasProfiles = (b.metadata.profileIds?.length || 0) > 0;
          if (aHasProfiles !== bHasProfiles) {
            return bHasProfiles ? 1 : -1;
          }

          if (aHasProfiles && bHasProfiles) {
            const aFirstProfileId = a.metadata.profileIds?.[0];
            const bFirstProfileId = b.metadata.profileIds?.[0];
            if (aFirstProfileId && bFirstProfileId) {
              const aProfile = profiles.find(p => p.id === aFirstProfileId);
              const bProfile = profiles.find(p => p.id === bFirstProfileId);
              if (aProfile && bProfile) {
                const profileComparison = aProfile.name.localeCompare(bProfile.name);
                if (profileComparison !== 0) return profileComparison;
              }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading mods...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-red-500">Error loading mods: {String(error)}</div>
      </div>
    );
  }

  if (!sortedMods || sortedMods.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg text-gray-500">
          {mods?.length === 0 ? 'No mods installed yet' : 'No mods match your filters'}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full overflow-auto mod-list-scroll">
        <div className="p-4">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedMods.map((mod, index) => (
                <AnimatedCard key={mod.id} index={index}>
                  <ModCard
                    mod={mod}
                    allCostumes={allCostumes}
                    sortBy={sortBy}
                    onClick={() => setSelectedModId(mod.id)}
                    onContextMenu={(e) => handleContextMenu(e, mod)}
                  />
                </AnimatedCard>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedMods.map((mod, index) => (
                <AnimatedCard key={mod.id} index={index}>
                  <ModListItem
                    mod={mod}
                    allCostumes={allCostumes}
                    sortBy={sortBy}
                    onClick={() => setSelectedModId(mod.id)}
                    onContextMenu={(e) => handleContextMenu(e, mod)}
                  />
                </AnimatedCard>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ModContextMenu
          mod={contextMenu.mod}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

// Grid view card - memoized to prevent re-renders when parent changes
const ModCard = memo(function ModCard({
  mod,
  allCostumes,
  sortBy,
  onClick,
  onContextMenu,
}: {
  mod: ModInfo;
  allCostumes: Record<string, Costume[]> | undefined;
  sortBy: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const toggleEnabled = useToggleModEnabled();
  const toggleFavorite = useToggleFavorite();
  const profiles = useUIStore((state) => state.profiles);

  // Get costume for this mod
  const costume = getCostumeForMod(mod, allCostumes);

  const categoryColors = {
    UI: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Audio: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Skins: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Gameplay: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  const categoryIcons = {
    UI: Monitor,
    Audio: Volume2,
    Skins: Shirt,
    Gameplay: Gamepad2,
  };

  const CategoryIcon = categoryIcons[mod.category] || Palette;

  // Convert thumbnail path to Tauri asset URL
  const thumbnailSrc = mod.thumbnailPath ? convertFileSrc(mod.thumbnailPath) : null;

  const handleToggleEnabled = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    toggleEnabled.mutate(mod.id);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    toggleFavorite.mutate(mod.id);
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`group relative border border-border rounded-lg cursor-pointer hover:border-primary/50 hover:shadow-lg hover:-translate-y-1.5 bg-card ${
        !mod.enabled ? 'opacity-50 grayscale' : ''
      }`}
      style={{
        transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), border-color 200ms ease, box-shadow 300ms ease',
      }}
    >
      {/* Disabled Overlay */}
      {!mod.enabled && (
        <div className="absolute inset-0 bg-black/30 z-10 pointer-events-none rounded-lg" />
      )}

      {/* Ambient background tint from thumbnail */}
      {thumbnailSrc && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
          <img
            src={thumbnailSrc}
            alt=""
            className="w-full h-full object-cover"
            style={{ filter: 'blur(40px) saturate(1.8)', opacity: 0.2 }}
          />
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative h-56 bg-black/50 overflow-hidden rounded-t-[7px]">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={mod.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-4xl mb-2">🎮</div>
              <div className="text-xs">No Preview</div>
            </div>
          </div>
        )}
        <div className="absolute -bottom-px left-0 right-0 h-3 pointer-events-none" style={{ background: 'linear-gradient(to top, var(--card), transparent)' }} />
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Badges Row - Category, NSFW, Linked, and Favorite Star */}
        <div className="flex items-center gap-2 pb-2.5 border-b border-border">
          <div className="flex flex-wrap gap-1.5 flex-1">
            {/* Category Badge with icon */}
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${categoryColors[mod.category]}`}>
              <CategoryIcon className="w-3 h-3" />
              {mod.category}
            </span>

            {/* NSFW Badge */}
            {mod.metadata.isNsfw && (
              <span className="text-xs px-2.5 py-0.5 rounded-full border bg-red-500/20 text-red-400 border-red-500/30 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                NSFW
              </span>
            )}

            {/* Linked Badge - only show if has nexusModId */}
            {mod.metadata.nexusModId && (
              <span className="text-xs px-2.5 py-0.5 rounded-full border bg-blue-500/20 text-blue-400 border-blue-500/30 font-medium flex items-center gap-1">
                <Link className="w-3 h-3" />
                Linked
              </span>
            )}

            {/* Profile Badges */}
            {mod.metadata.profileIds?.map((profileId) => {
              const profile = profiles.find((p) => p.id === profileId)
              if (!profile) return null

              const IconComponent = iconComponents[profile.icon] || Tag

              return (
                <Tooltip key={profileId}>
                  <TooltipTrigger asChild>
                    <span
                      className="text-xs px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1"
                      style={{
                        backgroundColor: `${profile.color}33`, // 20% opacity
                        color: profile.color,
                        borderColor: `${profile.color}4D`, // 30% opacity
                      }}
                    >
                      <IconComponent className="w-3 h-3" />
                      {profile.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Profile: {profile.name}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>

          {/* Favorite Star Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleToggleFavorite}
                className="p-1 rounded hover:bg-yellow-400/20 transition-all duration-200"
              >
                <Star
                  className={`w-4 h-4 transition-all duration-200 ${
                    mod.isFavorite
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-400 hover:text-yellow-400'
                  }`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {mod.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Title, Subtitle & Author */}
        <div className="py-1.5">
          {(() => {
            const { main, variant } = parseTitleParts(mod.metadata.title || mod.name);
            return (
              <>
                <h3 className="text-[26px] text-white leading-tight">
                  <MetallicTitle>{main}</MetallicTitle>
                </h3>
                {(variant || mod.metadata.subtitle) && (
                  <p className="text-sm line-clamp-1 leading-tight mt-1 text-gray-400">
                    {variant && <span className="italic font-light">{variant}</span>}
                    {variant && mod.metadata.subtitle && <span className="text-gray-600 mx-1.5">·</span>}
                    {mod.metadata.subtitle && <span className="font-semibold">{mod.metadata.subtitle}</span>}
                  </p>
                )}
              </>
            );
          })()}
        </div>

        {/* Character + Costume */}
        {mod.character && (
          <div className="flex items-center gap-2 py-2.5">
            {/* Character Icon + Name */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {mod.character === 'All Characters' ? (
                <div className="w-14 h-14 rounded-full bg-muted/50 border-2 border-border flex items-center justify-center">
                  <Users className="w-7 h-7 text-muted-foreground" />
                </div>
              ) : (
                <>
                  <img
                    src={getCharacterIconPath(mod.character)}
                    alt={mod.character}
                    loading="lazy"
                    className="w-14 h-14 rounded-full object-cover border-2 border-border"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-xs" style={{ display: 'none' }}>
                    {mod.character.slice(0, 2)}
                  </div>
                </>
              )}
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">{mod.character}</span>
            </div>

            {/* Costume */}
            {costume && (
              <>
                <div className="w-px h-10 bg-border/40 flex-shrink-0" />
                <img
                  src={`/assets/costume-icons/${costume.imagePath}`}
                  alt={costume.name}
                  loading="lazy"
                  className="w-12 h-12 rounded-full object-cover border border-border flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-xs font-medium text-foreground/70 line-clamp-2 min-w-0">{costume.name}</span>
              </>
            )}
          </div>
        )}

        {/* Footer - Author, File Size, Date, and Status */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2.5 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-sm"><span className="text-muted-foreground font-normal">By </span><span className="font-bold text-foreground/70">{mod.metadata.author || 'Unknown'}</span></span>
            <span>•</span>
            <span>{formatFileSize(mod.fileSize)}</span>
            <span>•</span>
            {sortBy === 'updated' ? (
              <span>{new Date(mod.lastModified).toLocaleDateString()} {new Date(mod.lastModified).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            ) : (
              <span>{new Date(mod.installDate).toLocaleDateString()} {new Date(mod.installDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleToggleEnabled}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-all duration-200 ${
                  mod.enabled
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:text-green-300'
                    : 'bg-gray-500/20 text-gray-400 hover:bg-red-600 hover:text-white grayscale-0'
                }`}
                style={!mod.enabled ? { filter: 'grayscale(0)' } : undefined}
              >
                {mod.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {mod.enabled ? 'Click to disable this mod' : 'Click to enable this mod'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});

// List view item - memoized to prevent re-renders when parent changes
const ModListItem = memo(function ModListItem({
  mod,
  allCostumes,
  sortBy,
  onClick,
  onContextMenu,
}: {
  mod: ModInfo;
  allCostumes: Record<string, Costume[]> | undefined;
  sortBy: string;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const toggleEnabled = useToggleModEnabled();
  const toggleFavorite = useToggleFavorite();
  const profiles = useUIStore((state) => state.profiles);

  // Get costume for this mod
  const costume = getCostumeForMod(mod, allCostumes);

  const categoryColors = {
    UI: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Audio: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    Skins: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Gameplay: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  const categoryIcons = {
    UI: Monitor,
    Audio: Volume2,
    Skins: Shirt,
    Gameplay: Gamepad2,
  };

  const CategoryIcon = categoryIcons[mod.category] || Palette;

  // Convert thumbnail path to Tauri asset URL
  const thumbnailSrc = mod.thumbnailPath ? convertFileSrc(mod.thumbnailPath) : null;

  const handleToggleEnabled = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    toggleEnabled.mutate(mod.id);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    toggleFavorite.mutate(mod.id);
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`group border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-1.5 bg-card relative ${
        !mod.enabled ? 'opacity-50 grayscale' : ''
      }`}
      style={{
        transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), border-color 200ms ease, box-shadow 300ms ease',
      }}
    >
      {/* Disabled Overlay */}
      {!mod.enabled && (
        <div className="absolute inset-0 bg-black/30 rounded-lg z-10 pointer-events-none" />
      )}

      <div className="flex items-center gap-4">
        {/* Thumbnail - 16:9 aspect ratio, larger size */}
        <div className="w-36 h-20 rounded-md bg-black/50 overflow-hidden flex-shrink-0">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={mod.name}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl">
              🎮
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges Row */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1 ${categoryColors[mod.category]}`}>
              <CategoryIcon className="w-3 h-3" />
              {mod.category}
            </span>
            {mod.metadata.isNsfw && (
              <span className="text-xs px-2.5 py-0.5 rounded-full border bg-red-500/20 text-red-400 border-red-500/30 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                NSFW
              </span>
            )}
            {mod.metadata.tags && mod.metadata.tags.slice(0, 2).map((tag, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <span className="text-xs px-2.5 py-0.5 rounded-full border bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {tag}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Tag: {tag}
                </TooltipContent>
              </Tooltip>
            ))}

            {/* Profile Badges */}
            {mod.metadata.profileIds?.map((profileId) => {
              const profile = profiles.find((p) => p.id === profileId)
              if (!profile) return null

              const IconComponent = iconComponents[profile.icon] || Tag

              return (
                <Tooltip key={profileId}>
                  <TooltipTrigger asChild>
                    <span
                      className="text-xs px-2.5 py-0.5 rounded-full border font-medium flex items-center gap-1"
                      style={{
                        backgroundColor: `${profile.color}33`, // 20% opacity
                        color: profile.color,
                        borderColor: `${profile.color}4D`, // 30% opacity
                      }}
                    >
                      <IconComponent className="w-3 h-3" />
                      {profile.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Profile: {profile.name}
                  </TooltipContent>
                </Tooltip>
              )
            })}

            {/* Favorite Star Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleFavorite}
                  className="ml-auto p-1 rounded hover:bg-black/20 transition-all duration-200"
                >
                  <Star
                    className={`w-4 h-4 transition-all duration-200 ${
                      mod.isFavorite
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-400 hover:text-yellow-400'
                    }`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {mod.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Title, Subtitle & Author */}
          {(() => {
            const { main, variant } = parseTitleParts(mod.metadata.title || mod.name);
            return (
              <>
                <h3 className="text-[21px] text-white mb-0.5 truncate">
                  <MetallicTitle>{main}</MetallicTitle>
                </h3>
                {(variant || mod.metadata.subtitle) && (
                  <p className="text-sm truncate mb-2 text-gray-400">
                    {variant && <span className="italic font-light">{variant}</span>}
                    {variant && mod.metadata.subtitle && <span className="text-gray-600 mx-1.5">·</span>}
                    {mod.metadata.subtitle && <span className="font-semibold">{mod.metadata.subtitle}</span>}
                  </p>
                )}
              </>
            );
          })()}

          {/* Character + Footer */}
          <div className="flex items-center justify-between gap-4">
            {/* Character + Costume */}
            {mod.character && (
              <div className="flex items-center gap-2">
                {/* Character Icon + Name (keep together on one line) */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {mod.character === 'All Characters' ? (
                    <div className="w-12 h-12 rounded-full bg-muted/50 border-2 border-border flex items-center justify-center">
                      <Users className="w-6 h-6 text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <img
                        src={getCharacterIconPath(mod.character)}
                        alt={mod.character}
                        loading="lazy"
                        className="w-12 h-12 rounded-full object-cover border-2 border-border"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xs" style={{ display: 'none' }}>
                        {mod.character.slice(0, 2)}
                      </div>
                    </>
                  )}
                  <span className="text-sm text-foreground whitespace-nowrap">{mod.character}</span>
                </div>

                {/* Costume - Icons on same line, name can wrap */}
                {costume && (
                  <>
                    <div className="w-px h-9 bg-border/40 flex-shrink-0" />
                    <img
                      src={`/assets/costume-icons/${costume.imagePath}`}
                      alt={costume.name}
                      loading="lazy"
                      className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="text-xs font-medium text-foreground/70 line-clamp-2 min-w-0">{costume.name}</span>
                  </>
                )}
              </div>
            )}

            {/* Footer Info */}
            <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto">
              <span className="text-sm"><span className="text-muted-foreground font-normal">By </span><span className="font-bold text-foreground/70">{mod.metadata.author || 'Unknown'}</span></span>
              <span>•</span>
              <span>{formatFileSize(mod.fileSize)}</span>
              <span>•</span>
              {sortBy === 'updated' ? (
                <span>{new Date(mod.lastModified).toLocaleDateString()} {new Date(mod.lastModified).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              ) : (
                <span>{new Date(mod.installDate).toLocaleDateString()} {new Date(mod.installDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleToggleEnabled}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-all duration-200 ${
                      mod.enabled
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 hover:text-green-300'
                        : 'bg-gray-500/20 text-gray-400 hover:bg-red-600 hover:text-white grayscale-0'
                    }`}
                    style={!mod.enabled ? { filter: 'grayscale(0)' } : undefined}
                  >
                    {mod.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {mod.enabled ? 'Click to disable this mod' : 'Click to enable this mod'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Styled main title part with metallic gradient + subtle lift
function MetallicTitle({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-extrabold uppercase tracking-tight"
      style={{
        background: 'linear-gradient(to bottom, #ffffff 0%, #c0c8d0 50%, #a0aab4 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
      }}
    >
      {children}
    </span>
  );
}

// Parse title into main part and variant part
function parseTitleParts(title: string): { main: string; variant: string | null } {
  // Check for bracket pattern: "Main Title [Variant]"
  const bracketMatch = title.match(/^(.+?)\s*\[([^\]]+)\](.*)$/);
  if (bracketMatch && bracketMatch[1]) {
    return { main: bracketMatch[1].trim(), variant: `[${bracketMatch[2]}]${bracketMatch[3] || ''}` };
  }

  // Check for dash separators: "Main Title - Variant"
  const dashMatch = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch && dashMatch[1] && dashMatch[2]) {
    return { main: dashMatch[1].trim(), variant: dashMatch[2].trim() };
  }

  return { main: title, variant: null };
}
