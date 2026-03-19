import React from 'react'
import {
  Zap, Flame, Sparkles, Star, Target, Rocket, Diamond,
  Wand2 as Wand, Shield, Sword, Trophy, Crown, Gamepad2,
  Home, Heart, Settings as Cog, Triangle, Circle,
  Star as StarIcon, Moon, ArrowRight, Volume2, Layers, Disc,
} from 'lucide-react'
import { DEFAULT_ICON_OPTIONS } from '../../shared/profiles'
import { cn } from '../../lib/utils'

interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
  selectedColor?: string
}

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Flame, Sparkles, Star, Target, Rocket, Diamond, Wand,
  Shield, Sword, Trophy, Crown, Gamepad2, Home, Heart, Cog,
  Triangle, Circle, StarIcon, Moon, ArrowRight, Volume2, Layers, Disc,
}

export function IconPicker({ value, onChange, selectedColor }: IconPickerProps) {
  const activeColor = selectedColor || '#22c55e'

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Icon</label>
      <div className="grid grid-cols-8 gap-1.5">
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
                'flex items-center justify-center p-2.5 rounded-xl transition-all duration-200',
                isSelected
                  ? 'scale-110'
                  : 'bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              )}
              style={isSelected ? {
                backgroundColor: `${activeColor}20`,
                color: activeColor,
                boxShadow: `0 0 0 2px ${activeColor}60`,
              } : undefined}
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
