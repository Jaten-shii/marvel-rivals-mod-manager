import { useState } from 'react';
import { useGetMods, useToggleModEnabled, useToggleFavorite, useGetAllCostumes } from '../hooks/useMods';
import { useUIStore } from '../stores';
import type { ModInfo, Costume } from '../types/mod.types';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Link, AlertTriangle, Shirt, Volume2, Palette, Gamepad2, Tag, Star, Monitor } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { ModContextMenu } from './ModContextMenu';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

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
  const { filters, viewMode, setSelectedModId, sortBy, selectedModId, profiles, activeProfileFilter } = useUIStore();
  const [contextMenu, setContextMenu] = useState<{ mod: ModInfo; x: number; y: number } | null>(null);

  // Debug logging
  console.log('[ModList] Loading state:', { isLoading, error, modsCount: mods?.length });

  const handleContextMenu = (e: React.MouseEvent, mod: ModInfo) => {
    e.preventDefault();
    setContextMenu({ mod, x: e.clientX, y: e.clientY });
  };

  // Filter mods based on current filters
  const filteredMods = mods?.filter((mod: ModInfo) => {
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

  // Sort mods based on selected sort option
  const sortedMods = filteredMods?.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
      case 'category':
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        // Secondary sort by name within category
        return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
      case 'character':
        const aChar = a.character || 'zzz'; // Put mods without character at the end
        const bChar = b.character || 'zzz';
        if (aChar !== bChar) {
          return aChar.localeCompare(bChar);
        }
        // Secondary sort by name within character
        return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
      case 'updated':
        // Sort by last updated date descending (newest first)
        return new Date(b.metadata.updatedAt).getTime() - new Date(a.metadata.updatedAt).getTime();
      case 'profile':
        // Mods with profiles first
        const aHasProfiles = (a.metadata.profileIds?.length || 0) > 0;
        const bHasProfiles = (b.metadata.profileIds?.length || 0) > 0;
        if (aHasProfiles !== bHasProfiles) {
          return bHasProfiles ? 1 : -1;
        }

        // If both have profiles, sort by first profile name
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

        // Secondary sort by name
        return (a.metadata.title || a.name).localeCompare(b.metadata.title || b.name);
      case 'date':
      default:
        // Sort by install date descending (newest first)
        return new Date(b.installDate).getTime() - new Date(a.installDate).getTime();
    }
  });

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
      <ScrollArea className="h-full">
        <div className={`p-4 ${selectedModId ? 'relative z-40' : ''}`}>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {sortedMods.map((mod) => (
                  <motion.div
                    key={mod.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ModCard
                      mod={mod}
                      allCostumes={allCostumes}
                      sortBy={sortBy}
                      onClick={() => setSelectedModId(mod.id)}
                      onContextMenu={(e) => handleContextMenu(e, mod)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {sortedMods.map((mod) => (
                  <motion.div
                    key={mod.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ModListItem
                      mod={mod}
                      allCostumes={allCostumes}
                      sortBy={sortBy}
                      onClick={() => setSelectedModId(mod.id)}
                      onContextMenu={(e) => handleContextMenu(e, mod)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </ScrollArea>

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

// Grid view card
function ModCard({
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
  const { profiles } = useUIStore();

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
      className={`group relative border border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 bg-card ${
        !mod.enabled ? 'opacity-50 grayscale' : ''
      }`}
      style={{
        willChange: 'transform',
      }}
    >
      {/* Disabled Overlay */}
      {!mod.enabled && (
        <div className="absolute inset-0 bg-black/30 z-10 pointer-events-none" />
      )}

      {/* Thumbnail - Clean, no overlays */}
      <div className="relative h-56 bg-black/50 overflow-hidden">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={mod.name}
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
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Badges Row - Category, NSFW, Linked, and Favorite Star */}
        <div className="flex items-center gap-2 pb-2.5 border-b border-border">
          <div className="flex flex-wrap gap-1.5 flex-1">
            {/* Category Badge with icon */}
            <span className={`text-xs px-2 py-0.5 rounded border font-medium flex items-center gap-1 ${categoryColors[mod.category]}`}>
              <CategoryIcon className="w-3 h-3" />
              {mod.category}
            </span>

            {/* NSFW Badge */}
            {mod.metadata.isNsfw && (
              <span className="text-xs px-2 py-0.5 rounded border bg-red-500/20 text-red-400 border-red-500/30 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                NSFW
              </span>
            )}

            {/* Linked Badge - only show if has nexusModId */}
            {mod.metadata.nexusModId && (
              <span className="text-xs px-2 py-0.5 rounded border bg-blue-500/20 text-blue-400 border-blue-500/30 font-medium flex items-center gap-1">
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
                      className="text-xs px-2 py-0.5 rounded border font-medium flex items-center gap-1"
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

        {/* Title & Author */}
        <div className="py-2.5">
          <h3 className="font-semibold text-base line-clamp-2 text-white mb-1">
            {mod.metadata.title || mod.name}
          </h3>

          {/* Author - always show, with placeholder if null */}
          <p className="text-xs text-gray-400 italic">
            By: {mod.metadata.author || 'Unknown Author'}
          </p>
        </div>

        {/* Character Section - Avatar + Name + Costume */}
        {mod.character && (
          <div className="flex items-center gap-2 py-2.5">
            {/* Character Icon + Name (keep together on one line) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <img
                src={getCharacterIconPath(mod.character)}
                alt={mod.character}
                className="w-10 h-10 rounded-full object-cover border-2 border-border"
                onError={(e) => {
                  // Fallback to initials if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs" style={{ display: 'none' }}>
                {mod.character.slice(0, 2)}
              </div>
              <span className="text-sm text-foreground whitespace-nowrap">{mod.character}</span>
            </div>

            {/* Costume - Icons on same line, name can wrap */}
            {costume && (
              <>
                <span className="text-gray-500 flex-shrink-0">•</span>
                <img
                  src={`/assets/costume-icons/${costume.imagePath}`}
                  alt={costume.name}
                  className="w-8 h-8 rounded object-cover border border-border flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="text-xs text-gray-400 line-clamp-2 min-w-0">{costume.name}</span>
              </>
            )}
          </div>
        )}

        {/* Footer - File Size, Date, and Status */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2.5 border-t border-border">
          <div className="flex items-center gap-2">
            <span>{formatFileSize(mod.fileSize)}</span>
            <span>•</span>
            {sortBy === 'updated' ? (
              <span>Updated {new Date(mod.lastModified).toLocaleDateString()}, {new Date(mod.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            ) : (
              <span>Installed {new Date(mod.installDate).toLocaleDateString()}, {new Date(mod.installDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
}

// List view item
function ModListItem({
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
  const { profiles } = useUIStore();

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
      className={`group border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-1 transition-all duration-200 bg-card relative ${
        !mod.enabled ? 'opacity-50 grayscale' : ''
      }`}
      style={{
        willChange: 'transform',
      }}
    >
      {/* Disabled Overlay */}
      {!mod.enabled && (
        <div className="absolute inset-0 bg-black/30 rounded-lg z-10 pointer-events-none" />
      )}

      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        <div className="w-24 h-24 rounded-md bg-black/50 overflow-hidden flex-shrink-0">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={mod.name}
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
            <span className={`text-xs px-2 py-0.5 rounded border font-medium flex items-center gap-1 ${categoryColors[mod.category]}`}>
              <CategoryIcon className="w-3 h-3" />
              {mod.category}
            </span>
            {mod.metadata.isNsfw && (
              <span className="text-xs px-2 py-0.5 rounded border bg-red-500/20 text-red-400 border-red-500/30 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                NSFW
              </span>
            )}
            {mod.metadata.tags && mod.metadata.tags.slice(0, 2).map((tag, i) => (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <span className="text-xs px-2 py-0.5 rounded border bg-blue-500/20 text-blue-400 border-blue-500/30">
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
                      className="text-xs px-2 py-0.5 rounded border font-medium flex items-center gap-1"
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

          {/* Title */}
          <h3 className="font-semibold text-base text-white mb-1 truncate">
            {mod.metadata.title || mod.name}
          </h3>

          {/* Author - always show, with placeholder if null */}
          <p className="text-xs text-gray-400 italic mb-2">
            By: {mod.metadata.author || 'Unknown Author'}
          </p>

          {/* Character + Footer */}
          <div className="flex items-center justify-between gap-4">
            {/* Character + Costume */}
            {mod.character && (
              <div className="flex items-center gap-2">
                {/* Character Icon + Name (keep together on one line) */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <img
                    src={getCharacterIconPath(mod.character)}
                    alt={mod.character}
                    className="w-8 h-8 rounded-full object-cover border-2 border-border"
                    onError={(e) => {
                      // Fallback to initials if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs" style={{ display: 'none' }}>
                    {mod.character.slice(0, 2)}
                  </div>
                  <span className="text-sm text-foreground whitespace-nowrap">{mod.character}</span>
                </div>

                {/* Costume - Icons on same line, name can wrap */}
                {costume && (
                  <>
                    <span className="text-gray-500 flex-shrink-0">•</span>
                    <img
                      src={`/assets/costume-icons/${costume.imagePath}`}
                      alt={costume.name}
                      className="w-7 h-7 rounded object-cover border border-border flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="text-xs text-gray-400 line-clamp-2 min-w-0">{costume.name}</span>
                  </>
                )}
              </div>
            )}

            {/* Footer Info */}
            <div className="flex items-center gap-3 text-xs text-gray-500 ml-auto">
              <span>{formatFileSize(mod.fileSize)}</span>
              <span>•</span>
              {sortBy === 'updated' ? (
                <span>Updated {new Date(mod.lastModified).toLocaleDateString()}, {new Date(mod.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              ) : (
                <span>Installed {new Date(mod.installDate).toLocaleDateString()}, {new Date(mod.installDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
