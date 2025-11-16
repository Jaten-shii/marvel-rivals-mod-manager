/**
 * Profile system for organizing mods with custom tags
 */

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
  // Row 1
  'Zap',
  'Flame',
  'Sparkles',
  'Star',
  'Target',
  'Rocket',
  // Row 2
  'Diamond',
  'Wand',
  'Shield',
  'Sword',
  'Trophy',
  'Crown',
  // Row 3
  'Gamepad2',
  'Home',
  'Heart',
  'Cog',
  'Triangle',
  'Circle',
  // Row 4
  'StarIcon',
  'Moon',
  'ArrowRight',
  'Volume2',
  'Layers',
  'Disc',
]

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
