import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../stores';
import { useDeleteMod, useToggleModEnabled, useToggleFavorite, useUpdateModMetadata } from '../hooks/useMods';
import type { ModInfo } from '../types/mod.types';
import { openPath } from '@tauri-apps/plugin-opener';
import { dirname } from '@tauri-apps/api/path';
import { Tag, ChevronRight } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface ModContextMenuProps {
  mod: ModInfo;
  x: number;
  y: number;
  onClose: () => void;
}

// Map icon names to Lucide components (same as ProfileItem and ModList)
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

export function ModContextMenu({ mod, x, y, onClose }: ModContextMenuProps) {
  const { setMetadataDialogOpen, profiles } = useUIStore();
  const deleteMod = useDeleteMod();
  const toggleEnabled = useToggleModEnabled();
  const toggleFavorite = useToggleFavorite();
  const updateMetadata = useUpdateModMetadata();
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y });
  const [showProfileSubmenu, setShowProfileSubmenu] = useState(false);

  useEffect(() => {
    // Adjust position if menu would go off screen
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = x;
      let newY = y;

      if (x + rect.width > viewportWidth) {
        newX = viewportWidth - rect.width - 10;
      }

      if (y + rect.height > viewportHeight) {
        newY = viewportHeight - rect.height - 10;
      }

      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleEditMetadata = () => {
    setMetadataDialogOpen(true, mod.id);
    onClose();
  };

  const handleShowInFolder = async () => {
    try {
      const dir = await dirname(mod.filePath);
      await openPath(dir);
    } catch (error) {
      console.error('Failed to show in folder:', error);
    }
    onClose();
  };

  const handleToggleEnabled = async () => {
    await toggleEnabled.mutateAsync(mod.id);
    onClose();
  };

  const handleToggleFavorite = async () => {
    await toggleFavorite.mutateAsync(mod.id);
    onClose();
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${mod.name}"?`)) {
      await deleteMod.mutateAsync(mod.id);
    }
    onClose();
  };

  const handleToggleProfile = async (profileId: string) => {
    // Toggle profile in mod's profileIds array
    const currentProfileIds = mod.metadata.profileIds || [];

    let updatedProfileIds: string[];
    if (currentProfileIds.includes(profileId)) {
      // Remove profile
      updatedProfileIds = currentProfileIds.filter(id => id !== profileId);
    } else {
      // Add profile
      updatedProfileIds = [...currentProfileIds, profileId];
    }

    const updatedMetadata = {
      ...mod.metadata,
      profileIds: updatedProfileIds.length > 0 ? updatedProfileIds : null,
    };

    await updateMetadata.mutateAsync({ modId: mod.id, metadata: updatedMetadata });
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-card border border-border rounded-md shadow-lg z-50 min-w-[200px] py-1"
      style={{ left: `${adjustedPosition.x}px`, top: `${adjustedPosition.y}px` }}
    >
      <button
        onClick={handleEditMetadata}
        className="w-full px-4 py-2 text-left text-sm text-white group transition-all duration-200 hover:bg-primary/20 hover:text-primary flex items-center gap-2"
      >
        <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        Edit Metadata
      </button>

      <button
        onClick={handleToggleFavorite}
        className={`w-full px-4 py-2 text-left text-sm group transition-all duration-200 flex items-center gap-2 ${
          mod.isFavorite
            ? 'text-yellow-400 hover:bg-yellow-400/20 hover:text-yellow-300'
            : 'text-white hover:bg-yellow-400/20 hover:text-yellow-400'
        }`}
      >
        <svg className={`w-4 h-4 transition-transform duration-200 group-hover:rotate-12 ${mod.isFavorite ? 'fill-yellow-400' : ''}`} fill={mod.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
        {mod.isFavorite ? 'Remove from Favorites' : 'Favorite'}
      </button>

      {/* Add Profile with Submenu */}
      <div
        className="relative"
        onMouseEnter={() => setShowProfileSubmenu(true)}
        onMouseLeave={() => setShowProfileSubmenu(false)}
      >
        <button
          className="w-full px-4 py-2 text-left text-sm text-white group transition-all duration-200 hover:bg-primary/20 hover:text-primary flex items-center gap-2 justify-between"
        >
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" />
            Manage Profiles
          </div>
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Profile Submenu */}
        {showProfileSubmenu && profiles.length > 0 && (
          <div className="absolute left-full top-0 ml-1 bg-card border border-border rounded-md shadow-lg min-w-[200px] py-1 z-50">
            {profiles.map((profile) => {
              const IconComponent = iconComponents[profile.icon] || Tag;
              const isAdded = mod.metadata.profileIds?.includes(profile.id);

              return (
                <button
                  key={profile.id}
                  onClick={() => handleToggleProfile(profile.id)}
                  className={`w-full px-4 py-2 text-left text-sm transition-all duration-200 flex items-center gap-2 justify-between ${
                    isAdded
                      ? 'hover:bg-red-400/20 hover:text-red-400'
                      : 'hover:bg-green-400/20 hover:text-green-400'
                  }`}
                >
                  <span
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border"
                    style={{
                      backgroundColor: `${profile.color}33`,
                      color: profile.color,
                      borderColor: `${profile.color}4D`,
                    }}
                  >
                    <IconComponent className="w-3 h-3" />
                    {profile.name}
                  </span>
                  <span className="text-xs opacity-70">
                    {isAdded ? 'Remove' : 'Add'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* No Profiles Message */}
        {showProfileSubmenu && profiles.length === 0 && (
          <div className="absolute left-full top-0 ml-1 bg-card border border-border rounded-md shadow-lg min-w-[180px] py-2 px-4 z-50">
            <div className="text-xs text-muted-foreground">No profiles available</div>
          </div>
        )}
      </div>

      <button
        onClick={handleToggleEnabled}
        className={`w-full px-4 py-2 text-left text-sm text-white group transition-all duration-200 flex items-center gap-2 ${
          mod.enabled
            ? 'hover:bg-red-400/20 hover:text-red-400'
            : 'hover:bg-green-400/20 hover:text-green-400'
        }`}
      >
        <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={mod.enabled
              ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              : "M13 10V3L4 14h7v7l9-11h-7z"
            }
          />
        </svg>
        {mod.enabled ? 'Disable Mod' : 'Enable Mod'}
      </button>

      <button
        onClick={handleShowInFolder}
        className="w-full px-4 py-2 text-left text-sm text-white group transition-all duration-200 hover:bg-primary/20 hover:text-primary flex items-center gap-2"
      >
        <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        Show in Folder
      </button>

      <div className="h-px bg-border my-1" />

      <button
        onClick={handleDelete}
        className="w-full px-4 py-2 text-left text-sm text-white group transition-all duration-200 hover:bg-red-400/20 hover:text-red-400 flex items-center gap-2"
      >
        <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Delete Mod
      </button>

      <div className="h-px bg-border my-1" />

      <div className="px-4 py-2 text-xs text-muted-foreground">
        <div className="font-medium truncate">{mod.name}</div>
        <div className="opacity-70">{mod.category}</div>
      </div>
    </div>
  );
}
