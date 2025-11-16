import React from 'react'
import {
  Zap,
  Flame,
  Sparkles,
  Star,
  Target,
  Rocket,
  Diamond,
  Wand2 as Wand,
  Shield,
  Sword,
  Trophy,
  Crown,
  Gamepad2,
  Home,
  Heart,
  Settings as Cog,
  Triangle,
  Circle,
  Star as StarIcon,
  Moon,
  ArrowRight,
  Volume2,
  Layers,
  Disc,
} from 'lucide-react'
import { DEFAULT_ICON_OPTIONS } from '../../shared/profiles'
import { cn } from '../../lib/utils'

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
}

// Map icon names to actual Lucide components
const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Flame,
  Sparkles,
  Star,
  Target,
  Rocket,
  Diamond,
  Wand,
  Shield,
  Sword,
  Trophy,
  Crown,
  Gamepad2,
  Home,
  Heart,
  Cog,
  Triangle,
  Circle,
  StarIcon,
  Moon,
  ArrowRight,
  Volume2,
  Layers,
  Disc,
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Icon</label>
      <div className="grid grid-cols-6 gap-2">
        {DEFAULT_ICON_OPTIONS.map((iconName) => {
          const IconComponent = iconComponents[iconName]
          if (!IconComponent) return null

          const isSelected = value === iconName

          return (
            <button
              key={iconName}
              type="button"
              onClick={() => onChange(iconName)}
              className={cn(
                'flex items-center justify-center p-3 rounded-md border transition-all duration-200',
                isSelected
                  ? 'bg-green-500/20 text-green-400 border-green-500/40'
                  : 'bg-[#191F24] text-foreground border-border hover:bg-accent hover:border-accent-foreground/20'
              )}
              title={iconName}
            >
              <IconComponent className="w-5 h-5" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
