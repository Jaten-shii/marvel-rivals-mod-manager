import { useEffect, useCallback } from 'react'
import { useUIContext } from '../contexts/UIContext'
import { useSettingsContext } from '../contexts/SettingsContext'
import type { Theme } from 'shared/types'

/**
 * Custom hook for theme management
 * Handles theme switching, persistence, and CSS class application
 */
export function useTheme() {
  const uiContext = useUIContext()
  const settingsContext = useSettingsContext()

  // Current theme from UI context (for immediate UI updates)
  const currentTheme = uiContext.theme

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    // Remove all theme classes
    root.classList.remove('dark', 'light')
    body.classList.remove('dark', 'light')

    // Add current theme class to match globals.css
    if (currentTheme === 'dark') {
      root.classList.add('dark')
      body.classList.add('dark')
    }
    // Light theme is the default, no class needed

  }, [currentTheme])

  // Sync theme with settings when settings change
  useEffect(() => {
    if (settingsContext.settings.theme !== currentTheme) {
      uiContext.setTheme(settingsContext.settings.theme)
    }
  }, [settingsContext.settings.theme, currentTheme, uiContext])

  // Theme switching with persistence
  const setTheme = useCallback((theme: Theme) => {
    uiContext.setTheme(theme)
    settingsContext.setTheme(theme)
  }, [uiContext, settingsContext])

  const toggleTheme = useCallback(() => {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
  }, [currentTheme, setTheme])

  // System theme detection
  const getSystemTheme = useCallback((): 'dark' | 'light' => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'dark'
  }, [])

  const setSystemTheme = useCallback(() => {
    const systemTheme = getSystemTheme()
    setTheme(systemTheme)
  }, [getSystemTheme, setTheme])

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user has system theme preference enabled
      if (settingsContext.settings.theme === 'system' || settingsContext.settings.theme === getSystemTheme()) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [settingsContext.settings.theme, getSystemTheme, setTheme])

  // Theme utilities
  const getThemeDisplayName = useCallback((theme: Theme): string => {
    switch (theme) {
      case 'dark':
        return 'Dark'
      case 'light':
        return 'Light'
      default:
        return 'Unknown'
    }
  }, [])

  const getThemeIcon = useCallback((theme: Theme): string => {
    switch (theme) {
      case 'dark':
        return '🌙'
      case 'light':
        return '☀️'
      default:
        return '🎨'
    }
  }, [])

  const getAvailableThemes = useCallback((): Theme[] => {
    return ['dark', 'light']
  }, [])

  const isThemeSupported = useCallback((theme: string): theme is Theme => {
    return ['dark', 'light'].includes(theme as Theme)
  }, [])

  // CSS class helpers
  const getThemeClasses = useCallback(() => {
    return {
      root: `theme-${currentTheme}`,
      card: '',
      overlay: '',
    }
  }, [currentTheme])

  return {
    // Current state
    currentTheme,
    
    // Theme switching
    setTheme,
    toggleTheme,
    setSystemTheme,
    
    // System theme detection
    getSystemTheme,
    
    // Theme utilities
    getThemeDisplayName,
    getThemeIcon,
    getAvailableThemes,
    isThemeSupported,
    
    // CSS helpers
    getThemeClasses,
  }
}