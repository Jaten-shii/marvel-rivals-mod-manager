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
import { c, tint } from '../shared/rivals-tokens'

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
      <DialogContent
        className="sm:max-w-[640px] p-0 gap-0 overflow-hidden"
        style={{ background: c.bg, border: `1px solid ${c.line2}`, borderRadius: 16 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3" style={{ padding: '20px 24px', borderBottom: `1px solid ${c.line}`, background: c.panel }}>
          <div className="grid place-items-center" style={{ width: 40, height: 40, borderRadius: 10, background: tint(selectedColor, 18), color: selectedColor, border: `1px solid ${tint(selectedColor, 40)}` }}>
            <IconPreview icon={selectedIcon} className="w-5 h-5" />
          </div>
          <div>
            <DialogTitle asChild>
              <h2 className="rivals-display" style={{ color: c.ink, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
                {isCreate ? 'Create Profile' : 'Edit Profile'}
              </h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="rivals-mono" style={{ color: c.ink3, fontSize: 11.5, marginTop: 2 }}>
                {isCreate ? 'Organize your mods with custom tags' : 'Update profile settings'}
              </p>
            </DialogDescription>
          </div>
        </div>

        <div className="flex flex-col gap-6" style={{ padding: '22px 24px' }}>
          {/* Profile Name */}
          <div className="flex flex-col gap-2" style={{ animation: 'metadata-fade-in 300ms ease-out both' }}>
            <label className="rivals-mono" style={{ color: c.ink3, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Profile Name</label>
            <div className="relative">
              <input
                type="text"
                value={profileName}
                onChange={handleNameChange}
                placeholder="Enter name…"
                maxLength={10}
                className="w-full outline-none transition-colors"
                style={{ padding: '11px 56px 11px 14px', borderRadius: 10, background: c.panel, color: c.ink, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 15 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = c.accent as string; e.currentTarget.style.boxShadow = `0 0 0 3px ${tint(c.accent, 18)}`; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = c.line2; e.currentTarget.style.boxShadow = 'none'; }}
                autoFocus
              />
              <span className="rivals-mono absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: c.muted, fontSize: 11 }}>
                {nameCharCount}/10
              </span>
            </div>
          </div>

          {/* Live Preview */}
          <div className="flex items-center justify-center" style={{ paddingTop: 2, animation: 'metadata-fade-in 300ms ease-out 60ms both' }}>
            <div
              className="inline-flex items-center gap-2"
              style={{ padding: '7px 14px', borderRadius: 999, background: tint(selectedColor, 18), color: selectedColor, border: `1px solid ${tint(selectedColor, 40)}`, fontFamily: c.font, fontSize: 13.5, fontWeight: 600 }}
            >
              <IconPreview icon={selectedIcon} className="w-4 h-4" />
              {profileName || 'Preview'}
            </div>
          </div>

          {/* Icon Picker */}
          <div style={{ animation: 'metadata-fade-in 300ms ease-out 120ms both' }}>
            <IconPicker value={selectedIcon} onChange={setSelectedIcon} selectedColor={selectedColor} />
          </div>

          {/* Color Picker */}
          <div style={{ animation: 'metadata-fade-in 300ms ease-out 180ms both' }}>
            <ColorPicker value={selectedColor} onChange={setSelectedColor} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5" style={{ padding: '18px 24px', borderTop: `1px solid ${c.line}`, background: c.panel }}>
          <button
            onClick={handleClose}
            className="btn-outline cursor-pointer"
            style={{ padding: '9px 18px', borderRadius: 9, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isFormValid}
            className="btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ padding: '9px 18px', borderRadius: 9, background: c.accent, color: c.onAccent, border: 'none', fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
          >
            {isCreate ? 'Create Profile' : 'Update Profile'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Tiny helper to render a profile icon by name for the preview
import * as LucideIcons from 'lucide-react'
import { PROFILE_ICON_COMPONENTS } from '../shared/profiles'
const PROFILE_ICONS = PROFILE_ICON_COMPONENTS(LucideIcons as unknown as Record<string, unknown>)
function IconPreview({ icon, className }: { icon: string; className?: string }) {
  const Icon = PROFILE_ICONS[icon] || LucideIcons.Zap
  return <Icon className={className} />
}
