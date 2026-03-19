import React, { useState, useEffect } from 'react'
import { useUIStore } from '../stores/useUIStore'
import {
  generateProfileId,
  isValidProfileName,
  isValidHexColor,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_ICON_OPTIONS,
  type Profile,
} from '../shared/profiles'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { IconPicker } from './ui/icon-picker'
import { ColorPicker } from './ui/color-picker'
import { toast } from 'sonner'

export function ProfileDialog() {
  const {
    profileDialogOpen,
    profileDialogMode,
    profileDialogProfileId,
    setProfileDialogOpen,
    profiles,
    addProfile,
    updateProfile,
  } = useUIStore()

  const [profileName, setProfileName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState(DEFAULT_ICON_OPTIONS[0] || 'Zap')
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR_PALETTE[0] || '#ef4444')
  const [nameCharCount, setNameCharCount] = useState(0)

  useEffect(() => {
    if (profileDialogMode === 'edit' && profileDialogProfileId) {
      const profile = profiles.find((p) => p.id === profileDialogProfileId)
      if (profile) {
        setProfileName(profile.name)
        setSelectedIcon(profile.icon)
        setSelectedColor(profile.color)
        setNameCharCount(profile.name.length)
      }
    } else if (profileDialogMode === 'create') {
      setProfileName('')
      setSelectedIcon(DEFAULT_ICON_OPTIONS[0] || 'Zap')
      setSelectedColor(DEFAULT_COLOR_PALETTE[0] || '#ef4444')
      setNameCharCount(0)
    }
  }, [profileDialogMode, profileDialogProfileId, profiles])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 10)
    setProfileName(value)
    setNameCharCount(value.length)
  }

  const handleClose = () => {
    setProfileDialogOpen(false)
    setProfileName('')
    setSelectedIcon(DEFAULT_ICON_OPTIONS[0] || 'Zap')
    setSelectedColor(DEFAULT_COLOR_PALETTE[0] || '#ef4444')
    setNameCharCount(0)
  }

  const handleSave = () => {
    if (!isValidProfileName(profileName)) {
      toast.error('Profile name must be 1-10 alphanumeric characters')
      return
    }
    if (!isValidHexColor(selectedColor)) {
      toast.error('Invalid color format')
      return
    }
    const isDuplicate = profiles.some(
      (p) =>
        p.name.toLowerCase() === profileName.toLowerCase() &&
        p.id !== profileDialogProfileId
    )
    if (isDuplicate) {
      toast.error('A profile with this name already exists')
      return
    }

    if (profileDialogMode === 'create') {
      const newProfile: Profile = {
        id: generateProfileId(),
        name: profileName,
        color: selectedColor,
        icon: selectedIcon,
        createdAt: new Date().toISOString(),
      }
      addProfile(newProfile)
      toast.success(`Profile "${profileName}" created`)
    } else if (profileDialogMode === 'edit' && profileDialogProfileId) {
      updateProfile(profileDialogProfileId, {
        name: profileName,
        color: selectedColor,
        icon: selectedIcon,
      })
      toast.success(`Profile "${profileName}" updated`)
    }

    handleClose()
  }

  const isFormValid = isValidProfileName(profileName) && isValidHexColor(selectedColor)
  const isCreate = profileDialogMode === 'create'

  return (
    <Dialog open={profileDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/40">
          <DialogTitle className="text-xl font-bold tracking-tight">
            {isCreate ? 'Create Profile' : 'Edit Profile'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-0.5">
            {isCreate ? 'Organize your mods with custom tags' : 'Update profile settings'}
          </DialogDescription>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Profile Name */}
          <div className="space-y-2" style={{ animation: 'metadata-fade-in 300ms ease-out both' }}>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile Name</label>
            <div className="relative">
              <input
                type="text"
                value={profileName}
                onChange={handleNameChange}
                placeholder="Enter name..."
                maxLength={10}
                className="w-full px-4 py-3 text-base rounded-xl bg-muted/30 text-foreground border border-border/40 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50">
                {nameCharCount}/10
              </span>
            </div>
          </div>

          {/* Live Preview */}
          <div className="flex items-center justify-center py-3" style={{ animation: 'metadata-fade-in 300ms ease-out 50ms both' }}>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border"
              style={{
                backgroundColor: `${selectedColor}20`,
                color: selectedColor,
                borderColor: `${selectedColor}40`,
              }}
            >
              <IconPreview icon={selectedIcon} className="w-4 h-4" />
              {profileName || 'Preview'}
            </div>
          </div>

          {/* Icon Picker */}
          <div style={{ animation: 'metadata-fade-in 300ms ease-out 100ms both' }}>
            <IconPicker value={selectedIcon} onChange={setSelectedIcon} selectedColor={selectedColor} />
          </div>

          {/* Color Picker */}
          <div style={{ animation: 'metadata-fade-in 300ms ease-out 150ms both' }}>
            <ColorPicker value={selectedColor} onChange={setSelectedColor} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/40">
          <button
            onClick={handleClose}
            className="h-10 px-5 text-sm rounded-xl bg-muted/30 text-foreground hover:bg-muted/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isFormValid}
            className="h-10 px-5 text-sm rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none font-medium"
          >
            {isCreate ? 'Create Profile' : 'Update Profile'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Tiny helper to render an icon by name for the preview
import * as LucideIcons from 'lucide-react'
function IconPreview({ icon, className }: { icon: string; className?: string }) {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Zap: LucideIcons.Zap, Flame: LucideIcons.Flame, Sparkles: LucideIcons.Sparkles,
    Star: LucideIcons.Star, Target: LucideIcons.Target, Rocket: LucideIcons.Rocket,
    Diamond: LucideIcons.Diamond, Wand: LucideIcons.Wand2, Shield: LucideIcons.Shield,
    Sword: LucideIcons.Sword, Trophy: LucideIcons.Trophy, Crown: LucideIcons.Crown,
    Gamepad2: LucideIcons.Gamepad2, Home: LucideIcons.Home, Heart: LucideIcons.Heart,
    Cog: LucideIcons.Settings, Triangle: LucideIcons.Triangle, Circle: LucideIcons.Circle,
    StarIcon: LucideIcons.Star, Moon: LucideIcons.Moon, ArrowRight: LucideIcons.ArrowRight,
    Volume2: LucideIcons.Volume2, Layers: LucideIcons.Layers, Disc: LucideIcons.Disc,
  }
  const Icon = iconMap[icon] || LucideIcons.Zap
  return <Icon className={className} />
}
