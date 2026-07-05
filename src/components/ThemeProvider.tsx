import { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { ThemeProviderContext, type Theme } from '@/lib/theme-context'
import { usePreferences } from '@/services/preferences'
import type { BackgroundIntensity } from '@/types/preferences'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

// Accent color per theme — drives the radial ripple on theme switch.
const THEME_ACCENT: Record<Theme, string> = {
  'dark-classic': '#e5c300',
  'light-classic': '#e5c300',
  forest: '#22c55e',
  ruby: '#ef4444',
  ice: '#3b82f6',
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

  // Apply background intensity preference on startup and when it changes
  useLayoutEffect(() => {
    const root = window.document.documentElement
    const intensity: BackgroundIntensity = preferences?.backgroundIntensity || 'normal'

    console.log('[ThemeProvider] Background intensity effect running')
    console.log('[ThemeProvider] preferences:', preferences)
    console.log('[ThemeProvider] backgroundIntensity from preferences:', preferences?.backgroundIntensity)
    console.log('[ThemeProvider] intensity to apply:', intensity)
    console.log('[ThemeProvider] Classes before:', root.classList.toString())

    // Remove existing intensity classes
    root.classList.remove('bg-dim', 'bg-black')

    // Apply intensity class if not normal
    if (intensity !== 'normal') {
      root.classList.add(`bg-${intensity}`)
    }

    console.log('[ThemeProvider] Classes after:', root.classList.toString())
  }, [preferences?.backgroundIntensity])

  // Toggle mod-card 3D tilt and cursor glow independently (both on by default;
  // each class disables its effect)
  useLayoutEffect(() => {
    const root = window.document.documentElement
    root.classList.toggle('no-card-tilt', preferences?.cardTilt === false)
    root.classList.toggle('no-card-glow', preferences?.cardGlow === false)
  }, [preferences?.cardTilt, preferences?.cardGlow])

  useEffect(() => {
    const root = window.document.documentElement

    // Remove all theme classes
    root.classList.remove('light-classic', 'dark-classic', 'forest', 'ruby', 'ice', 'light', 'dark')

    console.log('[ThemeProvider] Applying theme:', theme)
    console.log('[ThemeProvider] Document classes:', root.classList.toString())
    root.classList.add(theme)
    console.log('[ThemeProvider] Document classes after:', root.classList.toString())
  }, [theme])

  // Track the most recent pointer position so a theme change can radiate the
  // new accent out from where the user clicked.
  const pointerRef = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => window.removeEventListener('pointerdown', onDown, { capture: true })
  }, [])

  const value = {
    theme,
    setTheme: (next: Theme) => {
      localStorage.setItem(storageKey, next)

      // Lightweight accent-ripple: swap the theme instantly (cheap), and over
      // the top expand a single solid disc of the NEW accent from the click
      // point, then fade it out. No DOM snapshot, so it never lags. Skipped on
      // reduced-motion.
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduce) {
        setTheme(next)
        return
      }

      const { x, y } = pointerRef.current
      const accent = THEME_ACCENT[next] ?? 'var(--rivals-accent)'
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )

      // Layered accent ripple from the click point: a translucent colour wash,
      // a bright leading ring, a fainter trailing ring (droplet double-pulse),
      // and a quick core flash. Every layer is a fixed-size element animated
      // only via transform/opacity (GPU-composited, no layout), so the swap
      // stays instant and lag-free.
      const BASE = 40 // px diameter at scale 1
      const endScale = (endRadius * 2) / BASE
      const ease = 'cubic-bezier(0.16, 1, 0.3, 1)'

      const spawn = (
        css: string,
        frames: Keyframe[],
        opts: KeyframeAnimationOptions
      ) => {
        const el = document.createElement('div')
        el.style.cssText =
          `position:fixed;left:${x}px;top:${y}px;width:${BASE}px;height:${BASE}px;` +
          `margin:${-BASE / 2}px 0 0 ${-BASE / 2}px;border-radius:50%;` +
          `pointer-events:none;will-change:transform,opacity;` +
          css
        document.body.appendChild(el)
        const anim = el.animate(frames, opts)
        anim.onfinish = () => el.remove()
      }

      setTheme(next)

      // Soft accent wash that briefly tints the screen as it expands.
      spawn(
        `z-index:99998;background:radial-gradient(circle, color-mix(in oklch, ${accent} 45%, transparent) 0%, color-mix(in oklch, ${accent} 20%, transparent) 45%, transparent 72%);`,
        [
          { transform: 'scale(0)', opacity: 0.5 },
          { transform: `scale(${endScale})`, opacity: 0 },
        ],
        { duration: 900, easing: ease }
      )

      // Leading ring — bright edge of the wave.
      spawn(
        `z-index:99999;border:2.5px solid ${accent};` +
          `box-shadow:0 0 24px 4px ${accent}, inset 0 0 14px ${accent};`,
        [
          { transform: 'scale(0)', opacity: 0.95 },
          { transform: `scale(${endScale})`, opacity: 0 },
        ],
        { duration: 700, easing: ease }
      )

      // Trailing ring — fainter echo a beat behind.
      spawn(
        `z-index:99999;border:1.5px solid ${accent};opacity:0;` +
          `box-shadow:0 0 12px 1px ${accent};`,
        [
          { transform: 'scale(0)', opacity: 0.55 },
          { transform: `scale(${endScale * 0.9})`, opacity: 0 },
        ],
        { duration: 780, delay: 120, easing: ease, fill: 'backwards' }
      )

      // Core flash — a quick pop right at the click point.
      spawn(
        `z-index:99999;background:${accent};` +
          `box-shadow:0 0 30px 10px ${accent};`,
        [
          { transform: 'scale(0.1)', opacity: 1 },
          { transform: 'scale(2.2)', opacity: 0 },
        ],
        { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      )
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
