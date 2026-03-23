import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getNexusApiKey, setNexusApiKey, clearNexusApiKey } from '@/hooks/useNexusMods'
import { usePreferences, useSavePreferences } from '@/services/preferences'
import { toast } from 'sonner'
import { Key, ExternalLink } from 'lucide-react'

const SettingsSection: React.FC<{
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}> = ({ title, icon, children }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 px-1">
      {icon && <span className="text-muted-foreground/70">{icon}</span>}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
)

function NexusApiKeyInput() {
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences()
  const [apiKey, setApiKeyState] = React.useState(getNexusApiKey() || '')
  const [saved, setSaved] = React.useState(!!getNexusApiKey())

  // Sync from preferences on load
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
      // Also save to backend preferences for persistence
      if (preferences) {
        savePreferences.mutate({ ...preferences, nexusApiKey: apiKey.trim() })
      }
      setSaved(true)
      toast.success('Nexus Mods API key saved')
    }
  }

  const handleClear = () => {
    clearNexusApiKey()
    if (preferences) {
      savePreferences.mutate({ ...preferences, nexusApiKey: undefined })
    }
    setApiKeyState('')
    setSaved(false)
    toast.success('Nexus Mods API key removed')
  }

  return (
    <div className="flex gap-2">
      <Input
        type="password"
        value={apiKey}
        onChange={(e) => { setApiKeyState(e.target.value); setSaved(false) }}
        placeholder="Paste your API key here..."
        className="flex-1 text-sm font-mono"
      />
      {saved ? (
        <Button onClick={handleClear} variant="outline" size="sm" className="text-red-400 hover:text-red-300">
          Remove
        </Button>
      ) : (
        <Button onClick={handleSave} size="sm" disabled={!apiKey.trim()}>
          Save
        </Button>
      )}
    </div>
  )
}

export const AdvancedPane: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* API Key Section */}
      <SettingsSection title="API Key" icon={<Key className="w-4 h-4" />}>
        <div className="rounded-xl bg-muted/20 p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Required for "Download with Manager" from Nexus Mods. Get your key from{' '}
            <a
              href="https://www.nexusmods.com/users/myaccount?tab=api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              nexusmods.com <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <NexusApiKeyInput />
        </div>
      </SettingsSection>

      {/* How it works */}
      <SettingsSection title="How It Works" icon={<ExternalLink className="w-4 h-4" />}>
        <div className="rounded-xl bg-muted/20 p-4 space-y-2 text-xs text-muted-foreground">
          <p>1. Add your Nexus Mods API key above</p>
          <p>2. Go to a Marvel Rivals mod page on nexusmods.com</p>
          <p>3. Click "Download with Manager" on any file</p>
          <p>4. The mod will automatically download and install in this app</p>
        </div>
      </SettingsSection>
    </div>
  )
}
