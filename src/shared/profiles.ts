/**
 * Profile system for organizing mods with custom tags
 */
import type React from 'react'

export interface Profile {
  id: string
  name: string
  color: string // Hex color code (e.g., "#ef4444")
  icon: string // Lucide icon name (e.g., "Zap", "Flame")
  createdAt: string
  modCount?: number // Calculated dynamically from mods
}

/**
 * Default Lucide icon options for profile creation
 * Matching the icon grid shown in the design (4 rows × 6 columns)
 */
export const DEFAULT_ICON_OPTIONS: string[] = [
  // Combat / power
  'Zap',
  'Flame',
  'Sparkles',
  'Star',
  'Target',
  'Rocket',
  'Sword',
  'Swords',
  'Shield',
  'ShieldHalf',
  'Axe',
  'Bomb',
  // Status / fantasy
  'Diamond',
  'Gem',
  'Wand',
  'Trophy',
  'Crown',
  'Medal',
  'Award',
  'Skull',
  'Ghost',
  'Atom',
  'Orbit',
  'Snowflake',
  // Symbols
  'Heart',
  'Eye',
  'Anchor',
  'Bolt',
  'Sun',
  'Moon',
  'Triangle',
  'Circle',
  'Hexagon',
  'Square',
  'Cloud',
  'Droplet',
  // Utility / objects
  'Gamepad2',
  'Joystick',
  'Home',
  'Cog',
  'Wrench',
  'Layers',
  'Disc',
  'Volume2',
  'Music',
  'Palette',
  'Tag',
  'Bookmark',
]

/**
 * Maps a profile icon name to its Lucide component. Single source of truth so
 * the picker, previews, sidebar items, and context menu all stay in sync.
 * Pass `import * as LucideIcons from 'lucide-react'` to avoid importing the
 * whole icon set into this shared module.
 */
type IconComp = React.ComponentType<{ className?: string }>;
export function PROFILE_ICON_COMPONENTS(L: Record<string, unknown>): Record<string, IconComp> {
  // Names whose Lucide export differs from the stored option name.
  const aliases: Record<string, string> = {
    Wand: 'Wand2',
    Cog: 'Settings',
    Bolt: 'Zap',
  };
  const map: Record<string, IconComp> = {};
  for (const name of DEFAULT_ICON_OPTIONS) {
    const exportName = aliases[name] ?? name;
    const comp = (L[exportName] ?? L[name]) as IconComp | undefined;
    if (comp) map[name] = comp;
  }
  // Legacy names that may exist on saved profiles but aren't in the picker.
  const legacy: Record<string, string> = { StarIcon: 'Star', ArrowRight: 'ArrowRight' };
  for (const [name, exportName] of Object.entries(legacy)) {
    const comp = L[exportName] as IconComp | undefined;
    if (comp) map[name] = comp;
  }
  return map;
}

/**
 * Default color palette for profile creation
 * Matching the color grid shown in the design (4 rows × 5 columns)
 */
export const DEFAULT_COLOR_PALETTE: string[] = [
  // Row 1: Reds and oranges
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  // Row 2: Greens and teals
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  // Row 3: Blues and purples
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  // Row 4: Pinks and grays
  '#ec4899',
  '#f43f5e',
  '#94a3b8',
  '#64748b',
  '#1e293b',
]

/**
 * Helper function to generate a unique profile ID
 */
export function generateProfileId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Helper function to validate hex color format
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color)
}

/**
 * Helper function to check if icon name is valid
 */
export function isValidIconName(icon: string): boolean {
  return DEFAULT_ICON_OPTIONS.includes(icon)
}

/**
 * Helper function to validate profile name
 */
export function isValidProfileName(name: string): boolean {
  return name.length >= 1 && name.length <= 10 && /^[a-zA-Z0-9\s]+$/.test(name)
}

/**
 * Helper function to convert hex color to rgba with opacity
 */
export function hexToRgba(hex: string, opacity: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
