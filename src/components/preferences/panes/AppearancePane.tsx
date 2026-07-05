import React, { useCallback } from 'react'
import { useTheme } from '@/hooks/use-theme'
import { usePreferences, useSavePreferences } from '@/services/preferences'
import { Moon, Sun, TreePine, Flame, Snowflake, Palette, Type, SquareStack, Sparkles } from 'lucide-react'
import type { BackgroundIntensity } from '@/types/preferences'
import { c } from '@/shared/rivals-tokens'
import { Switch } from '@/components/ui/switch'
import { SettingsSection, SettingsCard, SettingRow, ChoiceTile } from '../settings-ui'

interface ThemeOption {
  id: 'dark-classic' | 'light-classic' | 'forest' | 'ruby' | 'ice'
  name: string
  icon: React.ReactElement
  activeColor: string
}

const themeOptions: ThemeOption[] = [
  { id: 'dark-classic', name: 'Dark Classic', activeColor: '#e5c300', icon: <Moon className="w-7 h-7 transition-transform duration-300 group-hover:scale-110" /> },
  { id: 'light-classic', name: 'Light Classic', activeColor: '#e5c300', icon: <Sun className="w-7 h-7 transition-transform duration-300 group-hover:rotate-90" /> },
  { id: 'forest', name: 'Forest', activeColor: '#22c55e', icon: <TreePine className="w-7 h-7 transition-transform duration-300 group-hover:scale-110" /> },
  { id: 'ruby', name: 'Ruby', activeColor: '#ef4444', icon: <Flame className="w-7 h-7 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" /> },
  { id: 'ice', name: 'Ice', activeColor: '#3b82f6', icon: <Snowflake className="w-7 h-7 transition-transform duration-300 group-hover:rotate-180" /> },
]

const fontOptions: { id: 'ubuntu' | 'quicksand'; name: string; fontFamily: string }[] = [
  { id: 'ubuntu', name: 'Ubuntu', fontFamily: 'Ubuntu, sans-serif' },
  { id: 'quicksand', name: 'Quicksand', fontFamily: 'Quicksand, sans-serif' },
]

// Background swatches per theme — surfaces are tinted to match each theme's
// accent (warm for Dark Classic, green for Forest, wine for Ruby, slate for
// Ice), so the previews follow the selected theme.
const darkClassicPreviews: Record<BackgroundIntensity, string> = { normal: '#16140f', dim: '#0e0d09', black: '#000000' }
const intensityPreviews: Record<string, Record<BackgroundIntensity, string>> = {
  'dark-classic': darkClassicPreviews,
  'light-classic': { normal: '#efe9d7', dim: '#e3dcc6', black: '#d6cfb8' },
  forest: { normal: '#0f1410', dim: '#090d0a', black: '#000000' },
  ruby: { normal: '#160f10', dim: '#0e090a', black: '#000000' },
  ice: { normal: '#0f1216', dim: '#090b0e', black: '#000000' },
}

const intensityOptions: { id: BackgroundIntensity; name: string }[] = [
  { id: 'normal', name: 'Normal' },
  { id: 'dim', name: 'Dim' },
  { id: 'black', name: 'Black' },
]

export const AppearancePane: React.FC = () => {
  const { theme, setTheme } = useTheme()
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences()
  const [selectedFont, setSelectedFont] = React.useState<'ubuntu' | 'quicksand'>((preferences?.font as 'ubuntu' | 'quicksand') || 'quicksand')
  const [selectedIntensity, setSelectedIntensity] = React.useState<BackgroundIntensity>((preferences?.backgroundIntensity as BackgroundIntensity) || 'normal')
  const [cardTilt, setCardTilt] = React.useState<boolean>(preferences?.cardTilt !== false)
  const [cardGlow, setCardGlow] = React.useState<boolean>(preferences?.cardGlow !== false)

  const handleThemeChange = useCallback(
    async (value: ThemeOption['id']) => {
      setTheme(value)
      savePreferences.mutate({ theme: value, font: selectedFont, backgroundIntensity: selectedIntensity, cardTilt, cardGlow })
    },
    [setTheme, savePreferences, selectedFont, selectedIntensity, cardTilt, cardGlow]
  )

  const handleFontChange = useCallback(
    async (value: 'ubuntu' | 'quicksand') => {
      setSelectedFont(value)
      savePreferences.mutate({ theme, font: value, backgroundIntensity: selectedIntensity, cardTilt, cardGlow })
    },
    [savePreferences, theme, selectedIntensity, cardTilt, cardGlow]
  )

  const handleIntensityChange = useCallback(
    async (value: BackgroundIntensity) => {
      setSelectedIntensity(value)
      savePreferences.mutate({ theme, font: selectedFont, backgroundIntensity: value, cardTilt, cardGlow })
    },
    [savePreferences, theme, selectedFont, cardTilt, cardGlow]
  )

  const handleCardTiltChange = useCallback(
    (value: boolean) => {
      setCardTilt(value)
      savePreferences.mutate({ theme, font: selectedFont, backgroundIntensity: selectedIntensity, cardTilt: value, cardGlow })
    },
    [savePreferences, theme, selectedFont, selectedIntensity, cardGlow]
  )

  const handleCardGlowChange = useCallback(
    (value: boolean) => {
      setCardGlow(value)
      savePreferences.mutate({ theme, font: selectedFont, backgroundIntensity: selectedIntensity, cardTilt, cardGlow: value })
    },
    [savePreferences, theme, selectedFont, selectedIntensity, cardTilt]
  )

  React.useEffect(() => {
    if (preferences?.font) setSelectedFont(preferences.font as 'ubuntu' | 'quicksand')
    if (preferences?.backgroundIntensity) setSelectedIntensity(preferences.backgroundIntensity as BackgroundIntensity)
    if (preferences?.cardTilt !== undefined) setCardTilt(preferences.cardTilt !== false)
    if (preferences?.cardGlow !== undefined) setCardGlow(preferences.cardGlow !== false)
  }, [preferences?.font, preferences?.backgroundIntensity, preferences?.cardTilt, preferences?.cardGlow])

  return (
    <>
      {/* Theme / accent */}
      <SettingsSection title="Color Theme" icon={<Palette className="w-4 h-4" />}>
        <div className="grid grid-cols-5 gap-2.5">
          {themeOptions.map((option) => {
            const active = theme === option.id
            return (
              <ChoiceTile key={option.id} active={active} disabled={savePreferences.isPending} onClick={() => handleThemeChange(option.id)} activeColor={option.activeColor} className="aspect-square">
                <span style={{ color: active ? option.activeColor : c.ink3 }}>{option.icon}</span>
                <span style={{ color: c.ink, fontFamily: c.font, fontSize: 12, fontWeight: 500 }}>{option.name}</span>
              </ChoiceTile>
            )
          })}
        </div>
      </SettingsSection>

      <div className="grid grid-cols-2 gap-8">
        {/* Font */}
        <SettingsSection title="Body Font" icon={<Type className="w-4 h-4" />}>
          <div className="flex gap-2.5">
            {fontOptions.map((option) => (
              <ChoiceTile key={option.id} active={selectedFont === option.id} disabled={savePreferences.isPending} onClick={() => handleFontChange(option.id)} className="flex-1" >
                <span style={{ color: c.ink, fontFamily: option.fontFamily, fontSize: 28, fontWeight: 700 }}>Aa</span>
                <span style={{ color: c.ink2, fontFamily: c.font, fontSize: 12, fontWeight: 500 }}>{option.name}</span>
              </ChoiceTile>
            ))}
          </div>
        </SettingsSection>

        {/* Background */}
        <SettingsSection title="Background" icon={<SquareStack className="w-4 h-4" />}>
          <div className="flex gap-2.5">
            {intensityOptions.map((option) => (
              <ChoiceTile key={option.id} active={selectedIntensity === option.id} disabled={savePreferences.isPending} onClick={() => handleIntensityChange(option.id)} className="flex-1">
                <span style={{ width: 36, height: 36, borderRadius: 8, background: (intensityPreviews[theme] ?? darkClassicPreviews)[option.id], border: `1px solid ${c.line2}` }} />
                <span style={{ color: c.ink2, fontFamily: c.font, fontSize: 12, fontWeight: 500 }}>{option.name}</span>
              </ChoiceTile>
            ))}
          </div>
        </SettingsSection>
      </div>

      {/* Card effects */}
      <SettingsSection title="Card Effects" icon={<Sparkles className="w-4 h-4" />}>
        <SettingsCard>
          <SettingRow
            label="3D Tilt"
            description="Cards lean toward your cursor when you hover them"
            control={<Switch checked={cardTilt} onCheckedChange={handleCardTiltChange} />}
          />
          <SettingRow
            label="Cursor Glow"
            description="A glow tinted by the artwork follows your cursor across the card"
            control={<Switch checked={cardGlow} onCheckedChange={handleCardGlowChange} />}
          />
        </SettingsCard>
      </SettingsSection>
    </>
  )
}
