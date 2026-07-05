// Types that match the Rust AppPreferences struct
// Only contains settings that should be persisted to disk

// Background intensity options for customizing darkness level
export type BackgroundIntensity = 'normal' | 'dim' | 'black'

export interface AppPreferences {
  theme: string
  font?: string
  backgroundIntensity?: BackgroundIntensity
  cardTilt?: boolean // 3D tilt-toward-cursor on mod cards (default on)
  cardGlow?: boolean // dominant-color cursor glow on mod cards (default on)
  nexusApiKey?: string
}

export const defaultPreferences: AppPreferences = {
  theme: 'dark-classic',
  font: 'quicksand',
  backgroundIntensity: 'normal',
  cardTilt: true,
  cardGlow: true,
}
