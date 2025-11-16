import React, { useState, useEffect } from 'react'
import { Gamepad2 } from 'lucide-react'
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
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

  // Form state
  const [profileName, setProfileName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState(DEFAULT_ICON_OPTIONS[0] || 'Zap')
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR_PALETTE[0] || '#ef4444')
  const [nameCharCount, setNameCharCount] = useState(0)

  // Load profile data when editing
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
      // Reset form for new profile
      setProfileName('')
      setSelectedIcon(DEFAULT_ICON_OPTIONS[0] || 'Zap')
      setSelectedColor(DEFAULT_COLOR_PALETTE[0] || '#ef4444')
      setNameCharCount(0)
    }
  }, [profileDialogMode, profileDialogProfileId, profiles])

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 10) // Max 10 chars
    setProfileName(value)
    setNameCharCount(value.length)
  }

  const handleClose = () => {
    setProfileDialogOpen(false)
    // Reset form
    setProfileName('')
    setSelectedIcon(DEFAULT_ICON_OPTIONS[0] || 'Zap')
    setSelectedColor(DEFAULT_COLOR_PALETTE[0] || '#ef4444')
    setNameCharCount(0)
  }

  const handleSave = () => {
    // Validation
    if (!isValidProfileName(profileName)) {
      toast.error('Profile name must be 1-10 alphanumeric characters')
      return
    }

    if (!isValidHexColor(selectedColor)) {
      toast.error('Invalid color format')
      return
    }

    // Check for duplicate names (excluding current profile when editing)
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
      // Create new profile
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
      // Update existing profile
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

  return (
    <Dialog open={profileDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-primary" />
            <DialogTitle>
              {profileDialogMode === 'create' ? 'Create Profile' : 'Edit Profile'}
            </DialogTitle>
          </div>
          <DialogDescription>
            Create a new profile to organize your mods with custom tags.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Profile Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Profile Name</label>
            <div className="relative">
              <input
                type="text"
                value={profileName}
                onChange={handleNameChange}
                placeholder="Enter profile name (max 10 chars)"
                maxLength={10}
                className="w-full px-3 py-2 text-sm rounded-md border bg-[#191F24] text-foreground border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {nameCharCount}/10 characters
              </span>
            </div>
          </div>

          {/* Icon Picker */}
          <IconPicker value={selectedIcon} onChange={setSelectedIcon} />

          {/* Color Picker */}
          <ColorPicker value={selectedColor} onChange={setSelectedColor} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isFormValid}>
            {profileDialogMode === 'create' ? 'Create Profile' : 'Update Profile'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
