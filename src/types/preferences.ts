// Types that match the Rust AppPreferences struct
// Only contains settings that should be persisted to disk

// Background intensity options for customizing darkness level
export type BackgroundIntensity = 'normal' | 'dim' | 'black'

export interface AppPreferences {
  theme: string
  font?: string
  backgroundIntensity?: BackgroundIntensity
}

export const defaultPreferences: AppPreferences = {
  theme: 'dark-classic',
  font: 'quicksand',
  backgroundIntensity: 'normal',
}
