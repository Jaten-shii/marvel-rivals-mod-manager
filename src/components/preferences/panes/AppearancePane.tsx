import React, { useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useTheme } from '@/hooks/use-theme'
import { usePreferences, useSavePreferences } from '@/services/preferences'
import { Moon, Sun, TreePine, Flame, Snowflake } from 'lucide-react'

const SettingsField: React.FC<{
  label: string
  children: React.ReactNode
  description?: string
  centerText?: boolean
  largeLabel?: boolean
}> = ({ label, children, description, centerText = false, largeLabel = false }) => (
  <div className="space-y-2">
    <Label className={`font-medium text-foreground ${largeLabel ? 'text-lg' : 'text-sm'} ${centerText ? 'text-center block' : ''}`}>{label}</Label>
    {children}
    {description && (
      <p className={`text-sm text-muted-foreground ${centerText ? 'text-center' : ''}`}>{description}</p>
    )}
  </div>
)

const SettingsSection: React.FC<{
  title: string
  children: React.ReactNode
}> = ({ title, children }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      <Separator className="mt-2" />
    </div>
    <div className="space-y-4">{children}</div>
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

export const AppearancePane: React.FC = () => {
  const { theme, setTheme } = useTheme()
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences()
  const [selectedFont, setSelectedFont] = React.useState<'ubuntu' | 'quicksand'>(
    (preferences?.font as 'ubuntu' | 'quicksand') || 'quicksand'
  )

  const handleThemeChange = useCallback(
    async (value: 'dark-classic' | 'light-classic' | 'forest' | 'ruby' | 'ice') => {
      // Update the theme provider immediately for instant UI feedback
      setTheme(value)

      // Persist the theme preference to disk
      savePreferences.mutate({ theme: value, font: selectedFont })
    },
    [setTheme, savePreferences, selectedFont]
  )

  const handleFontChange = useCallback(
    async (value: 'ubuntu' | 'quicksand') => {
      setSelectedFont(value)

      // Persist font preference to disk (ThemeProvider will apply it)
      savePreferences.mutate({ theme, font: value })
    },
    [savePreferences, theme]
  )

  // Sync local state with loaded preferences
  React.useEffect(() => {
    if (preferences?.font) {
      const fontValue = preferences.font as 'ubuntu' | 'quicksand'
      setSelectedFont(fontValue)
    }
  }, [preferences?.font])

  return (
    <div className="space-y-6">
      <SettingsSection title="Theme">
        <SettingsField
          label="Color"
          description="Choose your preferred color theme from the Marvel Rivals collection"
          centerText={true}
          largeLabel={true}
        >
          <div className="grid grid-cols-5 gap-4 mt-2">
            {themeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleThemeChange(option.id)}
                disabled={savePreferences.isPending}
                className={`
                  group relative flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 transition-all duration-200 aspect-square
                  ${theme === option.id
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border bg-card hover:border-primary/50 hover:bg-card/80 hover:-translate-y-1 hover:shadow-lg'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                style={{
                  borderColor: theme === option.id ? option.activeColor : undefined,
                }}
                onMouseEnter={(e) => {
                  if (theme !== option.id) {
                    e.currentTarget.style.borderColor = option.hoverColor
                  }
                }}
                onMouseLeave={(e) => {
                  if (theme !== option.id) {
                    e.currentTarget.style.borderColor = ''
                  }
                }}
              >
                {theme === option.id && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" style={{ color: option.activeColor }}>
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
                <div className="text-center">
                  <div className="font-medium text-xs text-foreground">{option.name}</div>
                </div>
              </button>
            ))}
          </div>
        </SettingsField>

        <Separator className="my-8" />

        <SettingsField
          label="Font"
          description="Choose your preferred font family for the application"
          centerText={true}
          largeLabel={true}
        >
          <div className="flex justify-center gap-4 mt-2">
            {fontOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleFontChange(option.id)}
                disabled={savePreferences.isPending}
                className={`
                  group relative flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 transition-all duration-200 w-40 h-32
                  ${selectedFont === option.id
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border bg-card hover:border-primary/50 hover:bg-card/80 hover:-translate-y-1 hover:shadow-lg'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                style={{
                  borderColor: selectedFont === option.id ? (theme === 'forest' ? '#22c55e' : theme === 'ruby' ? '#ef4444' : theme === 'ice' ? '#3b82f6' : '#e5c300') : undefined,
                }}
              >
                {selectedFont === option.id && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div
                  className="text-4xl font-bold text-foreground"
                  style={{
                    fontFamily: option.fontFamily,
                  }}
                >
                  Aa
                </div>
                <div className="text-center">
                  <div className="font-medium text-xs text-foreground">{option.name}</div>
                </div>
              </button>
            ))}
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
