import { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { ThemeProviderContext, type Theme } from '@/lib/theme-context'
import { usePreferences } from '@/services/preferences'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark-classic',
  storageKey = 'ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  // Load theme and font from persistent preferences
  const { data: preferences } = usePreferences()
  const hasSyncedPreferences = useRef(false)

  // Sync theme with preferences when they load
  // This is a legitimate case of syncing with external async state (persistent preferences)
  // The ref ensures this only happens once when preferences first load
  useLayoutEffect(() => {
    if (preferences?.theme && !hasSyncedPreferences.current) {
      hasSyncedPreferences.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external async preferences on initial load
      setTheme(preferences.theme as Theme)
    }
  }, [preferences?.theme])

  // Apply font preference on startup and when it changes
  useLayoutEffect(() => {
    const root = window.document.documentElement
    if (preferences?.font) {
      // Remove existing font classes
      root.classList.remove('font-ubuntu', 'font-quicksand')
      // Apply saved font
      root.classList.add(`font-${preferences.font}`)
      console.log('[ThemeProvider] Applied font:', preferences.font)
    }
  }, [preferences?.font])

  useEffect(() => {
    const root = window.document.documentElement

    // Remove all theme classes
    root.classList.remove('light-classic', 'dark-classic', 'forest', 'ruby', 'ice', 'light', 'dark')

    console.log('[ThemeProvider] Applying theme:', theme)
    console.log('[ThemeProvider] Document classes:', root.classList.toString())
    root.classList.add(theme)
    console.log('[ThemeProvider] Document classes after:', root.classList.toString())
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
