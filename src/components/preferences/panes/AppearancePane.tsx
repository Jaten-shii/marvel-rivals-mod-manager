import React, { useCallback } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { usePreferences, useSavePreferences } from '@/services/preferences'
import { Moon, Sun, TreePine, Flame, Snowflake } from 'lucide-react'
import type { BackgroundIntensity } from '@/types/preferences'

const SettingsSection: React.FC<{
  title: string
  children: React.ReactNode
}> = ({ title, children }) => (
  <div className="space-y-3">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">{title}</h3>
    <div className="space-y-3">{children}</div>
  </div>
)

type ThemeOption = {
  id: 'dark-classic' | 'light-classic' | 'forest' | 'ruby' | 'ice'
  name: string
  icon: React.ReactElement
  hoverColor: string
  activeColor: string
}

type FontOption = {
  id: 'ubuntu' | 'quicksand'
  name: string
  fontFamily: string
}

const themeOptions: ThemeOption[] = [
  {
    id: 'dark-classic',
    name: 'Dark Classic',
    hoverColor: '#e5c300',
    activeColor: '#e5c300',
    icon: <Moon className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" />,
  },
  {
    id: 'light-classic',
    name: 'Light Classic',
    hoverColor: '#e5c300',
    activeColor: '#e5c300',
    icon: <Sun className="w-8 h-8 transition-transform duration-300 group-hover:rotate-90" />,
  },
  {
    id: 'forest',
    name: 'Forest',
    hoverColor: '#4ade80',
    activeColor: '#22c55e',
    icon: <TreePine className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" />,
  },
  {
    id: 'ruby',
    name: 'Ruby',
    hoverColor: '#f87171',
    activeColor: '#ef4444',
    icon: <Flame className="w-8 h-8 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />,
  },
  {
    id: 'ice',
    name: 'Ice',
    hoverColor: '#60a5fa',
    activeColor: '#3b82f6',
    icon: <Snowflake className="w-8 h-8 transition-transform duration-300 group-hover:rotate-180" />,
  },
]

const fontOptions: FontOption[] = [
  {
    id: 'ubuntu',
    name: 'Ubuntu',
    fontFamily: 'Ubuntu, sans-serif',
  },
  {
    id: 'quicksand',
    name: 'Quicksand',
    fontFamily: 'Quicksand, sans-serif',
  },
]

type IntensityOption = {
  id: BackgroundIntensity
  name: string
  description: string
  previewColor: string
}

const intensityOptions: IntensityOption[] = [
  {
    id: 'normal',
    name: 'Normal',
    description: 'Default grey',
    previewColor: 'oklch(0.2355 0.0131 243)',
  },
  {
    id: 'dim',
    name: 'Dim',
    description: 'Darker grey',
    previewColor: 'oklch(0.15 0.01 243)',
  },
  {
    id: 'black',
    name: 'Black',
    description: 'True black',
    previewColor: 'oklch(0 0 0)',
  },
]

export const AppearancePane: React.FC = () => {
  const { theme, setTheme } = useTheme()
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences()
  const [selectedFont, setSelectedFont] = React.useState<'ubuntu' | 'quicksand'>(
    (preferences?.font as 'ubuntu' | 'quicksand') || 'quicksand'
  )
  const [selectedIntensity, setSelectedIntensity] = React.useState<BackgroundIntensity>(
    (preferences?.backgroundIntensity as BackgroundIntensity) || 'normal'
  )

  const handleThemeChange = useCallback(
    async (value: 'dark-classic' | 'light-classic' | 'forest' | 'ruby' | 'ice') => {
      // Update the theme provider immediately for instant UI feedback
      setTheme(value)

      // Persist the theme preference to disk
      savePreferences.mutate({ theme: value, font: selectedFont, backgroundIntensity: selectedIntensity })
    },
    [setTheme, savePreferences, selectedFont, selectedIntensity]
  )

  const handleFontChange = useCallback(
    async (value: 'ubuntu' | 'quicksand') => {
      setSelectedFont(value)

      // Persist font preference to disk (ThemeProvider will apply it)
      savePreferences.mutate({ theme, font: value, backgroundIntensity: selectedIntensity })
    },
    [savePreferences, theme, selectedIntensity]
  )

  const handleIntensityChange = useCallback(
    async (value: BackgroundIntensity) => {
      console.log('[AppearancePane] handleIntensityChange called with:', value)
      console.log('[AppearancePane] Current theme:', theme)
      console.log('[AppearancePane] Current font:', selectedFont)
      setSelectedIntensity(value)

      // Persist intensity preference to disk (ThemeProvider will apply it)
      const payload = { theme, font: selectedFont, backgroundIntensity: value }
      console.log('[AppearancePane] Saving preferences:', payload)
      savePreferences.mutate(payload)
    },
    [savePreferences, theme, selectedFont]
  )

  // Sync local state with loaded preferences
  React.useEffect(() => {
    if (preferences?.font) {
      const fontValue = preferences.font as 'ubuntu' | 'quicksand'
      setSelectedFont(fontValue)
    }
    if (preferences?.backgroundIntensity) {
      setSelectedIntensity(preferences.backgroundIntensity as BackgroundIntensity)
    }
  }, [preferences?.font, preferences?.backgroundIntensity])

  return (
    <div className="space-y-8">
      {/* Color Theme Section */}
      <SettingsSection title="Color Theme">
        <div className="grid grid-cols-5 gap-2">
          {themeOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleThemeChange(option.id)}
              disabled={savePreferences.isPending}
              className={`
                group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all duration-200 aspect-square
                ${theme === option.id
                  ? 'bg-primary/10 ring-2 ring-primary shadow-sm'
                  : 'bg-muted/20 hover:bg-muted/40 hover:-translate-y-0.5'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              style={
                theme === option.id ? { '--tw-ring-color': option.activeColor } as React.CSSProperties : undefined
              }
              onMouseEnter={(e) => {
                if (theme !== option.id) {
                  e.currentTarget.style.backgroundColor = ''
                }
              }}
            >
              {theme === option.id && (
                <div className="absolute top-1.5 right-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: option.activeColor }}>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div
                className="flex items-center justify-center"
                style={{
                  color: theme === option.id ? option.activeColor : '#9ca3af',
                }}
              >
                {option.icon}
              </div>
              <div className="font-medium text-xs text-foreground">{option.name}</div>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Font & Background Row */}
      <div className="grid grid-cols-2 gap-8">
        {/* Font Section */}
        <SettingsSection title="Font">
          <div className="flex gap-2">
            {fontOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleFontChange(option.id)}
                disabled={savePreferences.isPending}
                className={`
                  group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all duration-200 flex-1 h-28
                  ${selectedFont === option.id
                    ? 'bg-primary/10 ring-2 ring-primary shadow-sm'
                    : 'bg-muted/20 hover:bg-muted/40 hover:-translate-y-0.5'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {selectedFont === option.id && (
                  <div className="absolute top-1.5 right-1.5">
                    <svg className="w-3.5 h-3.5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div
                  className="text-3xl font-bold text-foreground"
                  style={{ fontFamily: option.fontFamily }}
                >
                  Aa
                </div>
                <div className="font-medium text-xs text-foreground">{option.name}</div>
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* Background Intensity Section */}
        <SettingsSection title="Background">
          <div className="flex gap-2">
            {intensityOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleIntensityChange(option.id)}
                disabled={savePreferences.isPending}
                className={`
                  group relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all duration-200 flex-1 h-28
                  ${selectedIntensity === option.id
                    ? 'bg-primary/10 ring-2 ring-primary shadow-sm'
                    : 'bg-muted/20 hover:bg-muted/40 hover:-translate-y-0.5'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {selectedIntensity === option.id && (
                  <div className="absolute top-1.5 right-1.5">
                    <svg className="w-3.5 h-3.5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div
                  className="w-10 h-10 rounded-md"
                  style={{ backgroundColor: option.previewColor }}
                />
                <div className="font-medium text-xs text-foreground">{option.name}</div>
              </button>
            ))}
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}
