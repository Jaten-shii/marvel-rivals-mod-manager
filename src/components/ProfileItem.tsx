import React, { memo, useCallback } from 'react'
import { CircleX, Pencil, Trash2, Tag } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { type Profile } from '../shared/profiles'
import { cn } from '../lib/utils'

interface ProfileItemProps {
  profile: Profile
  active: boolean
  modCount: number
  onSelect: (profileId: string) => void
  onEdit: (profileId: string) => void
  onDisableAll: (profileId: string) => void
  onDelete: (profileId: string) => void
}

// Map icon names to Lucide components
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

export const ProfileItem = memo(function ProfileItem({
  profile,
  active,
  modCount,
  onSelect,
  onEdit,
  onDisableAll,
  onDelete,
}: ProfileItemProps) {
  const IconComponent = iconComponents[profile.icon] || Tag

  // Memoized handlers that call callbacks with profile ID
  const handleSelect = useCallback(() => {
    onSelect(profile.id)
  }, [onSelect, profile.id])

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(profile.id)
  }, [onEdit, profile.id])

  const handleDisableAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDisableAll(profile.id)
  }, [onDisableAll, profile.id])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(profile.id)
  }, [onDelete, profile.id])

  return (
    <div
      onClick={handleSelect}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all duration-200 cursor-pointer',
        active
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50'
      )}
    >
      {/* Profile Badge */}
      <span
        className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border flex-1 text-left"
        style={{
          backgroundColor: `${profile.color}33`, // 20% opacity
          color: profile.color,
          borderColor: `${profile.color}4D`, // 30% opacity
        }}
      >
        <IconComponent className="w-3 h-3 flex-shrink-0" />
        <span className="flex-1 truncate">{profile.name}</span>
      </span>

      {/* Mod Count */}
      <span className="text-xs text-muted-foreground min-w-[2ch] text-right">
        {modCount}
      </span>

      {/* Action Buttons (always visible) */}
      <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
        {/* Disable All Mods */}
        <button
          onClick={handleDisableAll}
          className="p-1 rounded hover:bg-orange-500/20 hover:text-orange-400 transition-colors group"
          title="Disable all mods in this profile"
        >
          <CircleX className="w-3.5 h-3.5" />
        </button>

        {/* Edit Profile */}
        <button
          onClick={handleEdit}
          className="p-1 rounded hover:bg-blue-500/20 hover:text-blue-400 transition-colors group"
          title="Edit profile"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        {/* Delete Profile Tag */}
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors group"
          title="Delete profile (removes tag from all mods)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
})
