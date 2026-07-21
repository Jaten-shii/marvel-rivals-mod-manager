import React from 'react'
import { getNexusApiKey, setNexusApiKey, clearNexusApiKey } from '@/hooks/useNexusMods'
import { usePreferences, useSavePreferences } from '@/services/preferences'
import { toast } from 'sonner'
import { Key, ExternalLink } from 'lucide-react'
import { c, tint } from '@/shared/rivals-tokens'
import { SettingsSection, SettingsCard } from '../settings-ui'

function NexusApiKeyInput() {
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences()
  const [apiKey, setApiKeyState] = React.useState(getNexusApiKey() || '')
  const [saved, setSaved] = React.useState(!!getNexusApiKey())

  React.useEffect(() => {
    if (preferences?.nexusApiKey && !getNexusApiKey()) {
      setNexusApiKey(preferences.nexusApiKey)
      setApiKeyState(preferences.nexusApiKey)
      setSaved(true)
    }
  }, [preferences?.nexusApiKey])

  const handleSave = () => {
    if (apiKey.trim()) {
      setNexusApiKey(apiKey.trim())
      if (preferences) savePreferences.mutate({ ...preferences, nexusApiKey: apiKey.trim() })
      setSaved(true)
      toast.success('Nexus Mods API key saved')
    }
  }

  const handleClear = () => {
    clearNexusApiKey()
    if (preferences) savePreferences.mutate({ ...preferences, nexusApiKey: undefined })
    setApiKeyState('')
    setSaved(false)
    toast.success('Nexus Mods API key removed')
  }

  return (
    <div className="flex gap-2">
      <input
        type="password"
        value={apiKey}
        onChange={(e) => { setApiKeyState(e.target.value); setSaved(false) }}
        placeholder="Paste your API key here…"
        className="settings-input flex-1 outline-none rivals-mono"
        style={{ padding: '8px 12px', background: c.bg, color: c.ink, border: `1px solid ${c.line2}`, borderRadius: 7, fontSize: 12.5 }}
      />
      {saved ? (
        <button
          onClick={handleClear}
          className="settings-btn cursor-pointer"
          style={{ padding: '8px 14px', borderRadius: 7, background: tint(c.err, 12), color: c.err, border: `1px solid ${tint(c.err, 40)}`, fontFamily: c.font, fontSize: 13, fontWeight: 600, ['--settings-btn-hue' as never]: c.err }}
        >
          Remove
        </button>
      ) : (
        <button
          onClick={handleSave}
          disabled={!apiKey.trim()}
          className="settings-btn cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ padding: '8px 14px', borderRadius: 7, background: c.accent, color: c.onAccent, border: 'none', fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
        >
          Save
        </button>
      )}
    </div>
  )
}

export const AdvancedPane: React.FC = () => {
  return (
    <>
      <SettingsSection title="API Key" icon={<Key className="w-4 h-4" />}>
        <SettingsCard pad={16} className="space-y-3">
          <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 12.5 }}>
            Required for &ldquo;Download with Manager&rdquo; from Nexus Mods. Every Nexus account gets a free
            personal key — here&rsquo;s where it hides:
          </p>
          <div className="space-y-2">
            {[
              <>Sign in on nexusmods.com, then open <span style={{ color: c.ink2, fontWeight: 600 }}>Site preferences → API Keys</span> (or use the button below)</>,
              <>Scroll to the very bottom of that page, to the <span style={{ color: c.ink2, fontWeight: 600 }}>Personal API Key</span> section</>,
              <>Click <span style={{ color: c.ink2, fontWeight: 600 }}>Request API Key</span>, then copy the key it generates</>,
              <>Paste it below and hit Save</>,
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5" style={{ color: c.ink2, fontFamily: c.font, fontSize: 12.5 }}>
                <span className="rivals-mono flex-shrink-0" style={{ color: c.accent, fontSize: 11, marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <a
            href="https://www.nexusmods.com/settings/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="settings-btn inline-flex items-center gap-2 cursor-pointer"
            style={{ padding: '7px 13px', borderRadius: 7, background: tint(c.accent, 12), color: c.accent, border: `1px solid ${tint(c.accent, 40)}`, fontFamily: c.font, fontSize: 12.5, fontWeight: 600, width: 'fit-content' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open your Nexus API keys page
          </a>
          <NexusApiKeyInput />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="How It Works" icon={<ExternalLink className="w-4 h-4" />}>
        <SettingsCard pad={16} className="space-y-2">
          {[
            'Add your Nexus Mods API key above',
            'Go to a Marvel Rivals mod page on nexusmods.com',
            'Click "Download with Manager" on any file',
            'The mod will automatically download and install in this app',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2.5" style={{ color: c.ink2, fontFamily: c.font, fontSize: 12.5 }}>
              <span className="rivals-mono flex-shrink-0" style={{ color: c.accent, fontSize: 11, marginTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
              <span>{step}</span>
            </div>
          ))}
        </SettingsCard>
      </SettingsSection>
    </>
  )
}
