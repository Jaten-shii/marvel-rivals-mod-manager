import { createContext } from 'react'

export type Theme = 'dark-classic' | 'light-classic' | 'forest' | 'ruby' | 'ice'

export interface ThemeProviderState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'dark-classic',
  setTheme: () => null,
}

export const ThemeProviderContext =
  createContext<ThemeProviderState>(initialState)
